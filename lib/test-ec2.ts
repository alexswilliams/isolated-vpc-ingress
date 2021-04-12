import {
  AutoScalingGroup,
  Signals,
  UpdatePolicy,
} from "@aws-cdk/aws-autoscaling";
import {
  IMachineImage,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Construct, Duration, Environment, Stack } from "@aws-cdk/core";

export type TestApplicationConfig = {
  autoScalingGroup: AutoScalingGroup;
  port: number;
};

export class TestEc2Stack extends Stack {
  readonly application: {
    autoScalingGroup: AutoScalingGroup;
    port: number;
  };

  constructor(
    scope: Construct,
    id: string,
    env: Required<Environment>,
    tags: { [key: string]: string },
    vpc: Vpc,
    ami: IMachineImage,
    hasPublicIp: boolean
  ) {
    super(scope, `AlexLnD-${id}`, { env, tags });

    const autoScalingGroup = new AutoScalingGroup(this, "ASG", {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: ami,

      vpc,
      vpcSubnets: vpc.selectSubnets({ onePerAz: true }),
      associatePublicIpAddress: hasPublicIp,
      allowAllOutbound: false,
      keyName: "test",

      maxCapacity: 1,
      minCapacity: 1,
      cooldown: Duration.minutes(1),
      updatePolicy: UpdatePolicy.replacingUpdate(),
      signals: Signals.waitForCount(0),
      maxInstanceLifetime: Duration.days(7),
    });

    this.application = {
      autoScalingGroup: autoScalingGroup,
      port: 3000,
    };
  }
}
