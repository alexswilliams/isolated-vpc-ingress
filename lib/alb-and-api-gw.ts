import { DomainName, HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2";
import { HttpAlbIntegration } from "@aws-cdk/aws-apigatewayv2-integrations";
import { ICertificate } from "@aws-cdk/aws-certificatemanager";
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import {
  ApplicationListener,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  ListenerCondition,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { ARecord, IHostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { ApiGatewayv2Domain } from "@aws-cdk/aws-route53-targets";
import { Construct, Duration, Environment, Stack } from "@aws-cdk/core";
import { TestApplicationConfig } from "./test-ec2";

export class AlbAndApiGwStack extends Stack {
  readonly internalAlb: ApplicationLoadBalancer;
  readonly listener: ApplicationListener;

  constructor(
    scope: Construct,
    id: string,
    env: Required<Environment>,
    tags: { [key: string]: string },
    vpc: Vpc,
    pathsToAppConfigs: { [key: string]: TestApplicationConfig },
    zone: IHostedZone,
    domainName: string,
    certificate: ICertificate
  ) {
    super(scope, `AlexLnD-LoadBalancers-${id}`, { env: env, tags });

    this.internalAlb = new ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: false,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.ISOLATED }),
    });

    this.listener = this.internalAlb.addListener("Listener", {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      open: false,
    });

    Object.entries(pathsToAppConfigs).forEach(
      ([serviceName, { autoScalingGroup, port }], index) => {
        this.listener.addAction(`Asg${index}-Action`, {
          conditions: [
            ListenerCondition.httpHeader("X-ISP-Desired-Service", [
              serviceName,
            ]),
          ],
          priority: index + 1,
          action: ListenerAction.forward([
            new ApplicationTargetGroup(this, `Asg${index}-TargetGroup`, {
              port,
              protocol: ApplicationProtocol.HTTP,
              vpc,
              targets: [autoScalingGroup],
              deregistrationDelay: Duration.seconds(2),
              healthCheck: {
                enabled: true,
                interval: Duration.seconds(10),
                healthyThresholdCount: 2,
                path: "/",
              },
            }),
          ]),
        });
      }
    );

    this.listener.addAction("FallbackAction", {
      action: ListenerAction.fixedResponse(404, {
        messageBody: "Fallback action says: not found\n",
        contentType: "text/plain",
      }),
    });

    const domainLink = new DomainName(this, "DomainName", {
      domainName,
      certificate,
    });

    const httpApi = new HttpApi(this, "HttpApiGw", {
      apiName: "VeryIsolated-HttpGw",
      createDefaultStage: true,
      defaultDomainMapping: { domainName: domainLink },
    });

    new ARecord(this, "GatewayDnsRecord", {
      zone,
      target: RecordTarget.fromAlias(new ApiGatewayv2Domain(domainLink)),
      recordName: domainName,
      ttl: Duration.seconds(60),
    });

    const vpcLink = httpApi.addVpcLink({
      vpc,
      subnets: vpc.selectSubnets({ subnetType: SubnetType.ISOLATED }),
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      integration: new HttpAlbIntegration({
        listener: this.listener,
        vpcLink,
        method: HttpMethod.GET,
      }),
    });

    const securityGroup = new SecurityGroup(this, "VPCLinkSecurityGroup", {
      vpc,
      allowAllOutbound: false,
    });
    this.internalAlb.connections.securityGroups.forEach((sg) =>
      securityGroup.connections.allowTo(sg, Port.tcp(80))
    );
    vpcLink.addSecurityGroups(securityGroup);
  }
}
