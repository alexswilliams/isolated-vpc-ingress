import {
  AclCidr,
  AclTraffic,
  NetworkAcl,
  SubnetType,
  TrafficDirection,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Construct, Environment, Stack } from "@aws-cdk/core";

export class VeryIsolatedVpcStack extends Stack {
  readonly vpc: Vpc;

  constructor(
    scope: Construct,
    env: Required<Environment>,
    tags: { [key: string]: string }
  ) {
    super(scope, "AlexLnD-VeryIsolatedVpcStack", { env, tags });

    this.vpc = new Vpc(this, "Vpc", {
      cidr: "10.64.0.0/20",
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "IsolatedSubnet",
          subnetType: SubnetType.ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const isolatedNacl = new NetworkAcl(this, "IsolatedNacl", {
      vpc: this.vpc,
      subnetSelection: this.vpc.selectSubnets({
        subnetType: SubnetType.ISOLATED,
      }),
    });
    isolatedNacl.addEntry("Incoming-Request-To-ALB", {
      // e.g. from the VPCLinks
      direction: TrafficDirection.INGRESS,
      ruleNumber: 1,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPort(80),
    });
    isolatedNacl.addEntry("Incoming-Request-To-EC2", {
      // e.g. from the ALBs
      direction: TrafficDirection.INGRESS,
      ruleNumber: 2,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPort(3000),
    });
    isolatedNacl.addEntry("Incoming-Replies-To-Ephemeral-Ports", {
      // e.g. to the VPCLinks
      // e.g. to the ALBs
      direction: TrafficDirection.INGRESS,
      ruleNumber: 10,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
    });

    isolatedNacl.addEntry("Outgoing-Requests-From-Ephemeral-Ports", {
      // e.g. from the VPCLinks
      // e.g. from the ALBs
      direction: TrafficDirection.EGRESS,
      ruleNumber: 1,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
    });

    isolatedNacl.addEntry("Outgoing-Replies-From-EC2s", {
      // e.g. to the ALBs
      direction: TrafficDirection.EGRESS,
      ruleNumber: 10,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPort(80),
    });
    isolatedNacl.addEntry("Outgoing-Replies-From-ALB", {
      // e.g. to the VPCLinks
      direction: TrafficDirection.EGRESS,
      ruleNumber: 11,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.tcpPort(3000),
    });
  }
}
