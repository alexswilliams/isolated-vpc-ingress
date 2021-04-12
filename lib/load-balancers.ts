import { ICertificate } from "@aws-cdk/aws-certificatemanager";
import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import {
  ApplicationListener,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  ListenerCondition,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { ARecord, IHostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { LoadBalancerTarget } from "@aws-cdk/aws-route53-targets";
import { Construct, Duration, Environment, Stack } from "@aws-cdk/core";
import { TestApplicationConfig } from "./test-ec2";

export class AlbStack extends Stack {
  readonly alb: ApplicationLoadBalancer;
  readonly listener: ApplicationListener;

  constructor(
    scope: Construct,
    id: string,
    env: Required<Environment>,
    tags: { [key: string]: string },
    vpc: Vpc,
    certificates: ICertificate[],
    domainsToAppConfigs: { [key: string]: TestApplicationConfig },
    zone: IHostedZone
  ) {
    super(scope, `AlexLnD-LoadBalancers-${id}`, { env: env, tags });

    this.alb = new ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }),
    });

    this.listener = this.alb.addListener("Listener", {
      certificates,
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      open: true,
    });

    Object.entries(domainsToAppConfigs).forEach(
      ([dnsName, { autoScalingGroup, port }], index) => {
        this.listener.addAction(`Asg${index}-Action`, {
          conditions: [ListenerCondition.hostHeaders([dnsName])],
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
        new ARecord(this, `Dns${index}`, {
          zone: zone,
          recordName: dnsName,
          ttl: Duration.seconds(60),
          target: RecordTarget.fromAlias(new LoadBalancerTarget(this.alb)),
        });
      }
    );

    this.listener.addAction("FallbackAction", {
      action: ListenerAction.fixedResponse(404, {
        messageBody: "Fallback action says: not found\n",
        contentType: "text/plain",
      }),
    });
  }
}
