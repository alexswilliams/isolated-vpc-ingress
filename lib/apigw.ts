import { DomainName, HttpApi } from "@aws-cdk/aws-apigatewayv2";
import { ICertificate } from "@aws-cdk/aws-certificatemanager";
import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { ARecord, IHostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import { ApiGatewayv2Domain } from "@aws-cdk/aws-route53-targets";
import { HttpNamespace } from "@aws-cdk/aws-servicediscovery";
import {
  CfnOutput,
  Construct,
  Duration,
  Environment,
  Stack,
} from "@aws-cdk/core";
import { TestApplicationConfig } from "./test-ec2";

export class ApiGatewayStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    env: Required<Environment>,
    tags: { [key: string]: string },
    vpc: Vpc,
    certificate: ICertificate,
    domainsToAppConfigs: { [key: string]: TestApplicationConfig },
    zone: IHostedZone
  ) {
    super(scope, `AlexLnD-ApiGateway-${id}`, { env: env, tags });

    const httpApi = new HttpApi(this, "ApiGateway", {
      apiName: "HttpGateway",
      createDefaultStage: false,
      disableExecuteApiEndpoint: true,
    });

    const vpcLink = httpApi.addVpcLink({
      vpc,
      subnets: vpc.selectSubnets({ subnetType: SubnetType.ISOLATED }),
      securityGroups: Object.values(domainsToAppConfigs).flatMap(
        (appConfig) => appConfig.autoScalingGroup.connections.securityGroups
      ),
    });

    const cloudMap = new HttpNamespace(this, "CloudMapNamespace", {
      name: "IsolatedNamespace",
    });

    Object.entries(domainsToAppConfigs).forEach(
      ([dnsName, { autoScalingGroup, port }], index) => {
        const dashDnsName = dnsName.replace(".", "-");
        const domainName = new DomainName(this, "DomainName-" + dashDnsName, {
          domainName: dnsName,
          certificate,
        });
        new ARecord(this, `Dns${index}`, {
          zone: zone,
          recordName: dnsName,
          ttl: Duration.seconds(60),
          target: RecordTarget.fromAlias(new ApiGatewayv2Domain(domainName)),
        });

        const stage = httpApi.addStage(dashDnsName, {
          autoDeploy: true,
          stageName: dashDnsName,
          domainMapping: {
            domainName,
            mappingKey: `/${index}`,
          },
        });
        new CfnOutput(this, `StageUrl${index}`, { value: stage.url });
      }
    );
  }
}
