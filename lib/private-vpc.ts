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

export class PrivateVpcStack extends Stack {
  readonly vpc: Vpc;

  constructor(
    scope: Construct,
    env: Required<Environment>,
    tags: { [key: string]: string }
  ) {
    super(scope, "AlexLnD-PrivateVpcStack", { env, tags });

    this.vpc = new Vpc(this, "Vpc", {
      cidr: "10.255.0.0/20",
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: "PrivateSubnet",
          subnetType: SubnetType.PRIVATE,
          cidrMask: 24,
        },
        {
          name: "AccompanyingPublicSubnet",
          subnetType: SubnetType.PUBLIC,
          cidrMask: 28,
        },
      ],
    });

    const publicNacl = new NetworkAcl(this, "AccompanyingPublicNacl", {
      vpc: this.vpc,
      subnetSelection: this.vpc.selectSubnets({
        subnetType: SubnetType.PUBLIC,
      }),
    });
    this.vpc.privateSubnets.forEach((subnet, index) => {
      publicNacl.addEntry(`AllowInboundApiResponse${index}`, {
        // return traffic from the services running in the private subnets
        direction: TrafficDirection.INGRESS,
        ruleNumber: index + 2,
        cidr: AclCidr.ipv4(subnet.ipv4CidrBlock),
        traffic: AclTraffic.tcpPortRange(1024, 65535),
      });
    });
    publicNacl.addEntry("DenyOtherTrafficFromPrivateSubnets", {
      direction: TrafficDirection.INGRESS,
      ruleNumber: 90,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.allTraffic(),
      ruleAction: Action.DENY,
    });
    publicNacl.addEntry("AllowInboundHttps", {
      // Incoming traffic from the public internet
      direction: TrafficDirection.INGRESS,
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
    });

    this.vpc.privateSubnets.forEach((subnet, index) => {
      publicNacl.addEntry(`AllowOutboundApiRequest${index}`, {
        // outgoing traffic destined for the service apis running in the private subnets
        direction: TrafficDirection.EGRESS,
        ruleNumber: index + 2,
        cidr: AclCidr.ipv4(subnet.ipv4CidrBlock),
        traffic: AclTraffic.tcpPort(3000),
      });
    });
    publicNacl.addEntry("DenyOtherTrafficToPrivateSubnets", {
      direction: TrafficDirection.EGRESS,
      ruleNumber: 90,
      cidr: AclCidr.ipv4(this.vpc.vpcCidrBlock),
      traffic: AclTraffic.allTraffic(),
      ruleAction: Action.DENY,
    });
    publicNacl.addEntry("AllowOutboundToEphemeralPorts", {
      // return traffic from the ALB to users on the public internet
      direction: TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
    });

    const privateNacl = new NetworkAcl(this, "PrivateNacl", {
      vpc: this.vpc,
      subnetSelection: this.vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE,
      }),
    });
    this.vpc.publicSubnets.forEach((subnet, index) => {
      privateNacl.addEntry(`AllowInboundApiTraffic${index}`, {
        // Incoming traffic from the ALBs destined for the service apis
        direction: TrafficDirection.INGRESS,
        ruleNumber: index + 1,
        cidr: AclCidr.ipv4(subnet.ipv4CidrBlock),
        traffic: AclTraffic.tcpPort(3000),
      });
      privateNacl.addEntry(`AllowOutboundToEphemeralPortsFromAlb${index}`, {
        // Return traffic to the ALB in the public subnets
        direction: TrafficDirection.EGRESS,
        ruleNumber: index + 1,
        cidr: AclCidr.ipv4(subnet.ipv4CidrBlock),
        traffic: AclTraffic.tcpPortRange(1024, 65535),
      });
    });
  }
}
