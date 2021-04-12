import {
  AclCidr,
  AclTraffic,
  Action,
  NetworkAcl,
  SubnetType,
  TrafficDirection,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Construct, Environment, Stack } from "@aws-cdk/core";

export class PublicVpcStack extends Stack {
  readonly vpc: Vpc;

  constructor(
    scope: Construct,
    env: Required<Environment>,
    tags: { [key: string]: string }
  ) {
    super(scope, "AlexLnD-VpcStack", { env, tags });

    this.vpc = new Vpc(this, "Vpc", {
      cidr: "10.0.0.0/20",
      maxAzs: 3,
      subnetConfiguration: [
        { name: "PublicSubnet", subnetType: SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const nacl = new NetworkAcl(this, "PublicNacl", {
      vpc: this.vpc,
      subnetSelection: this.vpc.selectSubnets({
        subnetType: SubnetType.PUBLIC,
      }),
    });
    nacl.addEntry("AllowInboundHttps", {
      direction: TrafficDirection.INGRESS,
      ruleNumber: 1,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
      ruleAction: Action.ALLOW,
    });
    nacl.addEntry("AllowOutboundToEphemeralPorts", {
      direction: TrafficDirection.EGRESS,
      ruleNumber: 1,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
      ruleAction: Action.ALLOW,
    });
  }
}
