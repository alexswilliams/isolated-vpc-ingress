import {
  AutoScalingGroup,
  Signals,
  UpdatePolicy,
} from "@aws-cdk/aws-autoscaling";
import {
  AmazonLinuxEdition,
  AmazonLinuxGeneration,
  CloudFormationInit,
  InitCommand,
  InitFile,
  InitService,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import { Construct, Duration, Environment, Stack } from "@aws-cdk/core";

export class TemplateEc2Stack extends Stack {
  readonly autoScalingGroup: AutoScalingGroup;
  readonly vmSecurityGroup: SecurityGroup;

  constructor(
    scope: Construct,
    env: Required<Environment>,
    tags: { [key: string]: string }
  ) {
    super(scope, "AlexLnD-Template-EC2-Stack", { env, tags });

    const vpc = new Vpc(this, "Vpc", {
      cidr: "10.10.0.0/23",
      maxAzs: 1,
      subnetConfiguration: [
        { name: "PublicSubnet", subnetType: SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    this.vmSecurityGroup = new SecurityGroup(this, "VmSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    this.vmSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.allTraffic());

    this.autoScalingGroup = new AutoScalingGroup(this, "ASG", {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
        edition: AmazonLinuxEdition.STANDARD,
      }),

      vpc,
      vpcSubnets: vpc.selectSubnets({ onePerAz: true }),
      associatePublicIpAddress: true,
      allowAllOutbound: true,
      securityGroup: this.vmSecurityGroup,
      keyName: "test",

      maxCapacity: 1,
      minCapacity: 1,
      cooldown: Duration.minutes(1),
      signals: Signals.waitForAll(),
      updatePolicy: UpdatePolicy.rollingUpdate(),
      maxInstanceLifetime: Duration.days(7),

      initOptions: { embedFingerprint: true, printLog: true },
      init: CloudFormationInit.fromElements(
        InitCommand.shellCommand(
          "curl --silent --location https://rpm.nodesource.com/setup_14.x | bash -"
        ),
        InitCommand.shellCommand("yum -y install nodejs"),
        InitCommand.shellCommand("mkdir -p /opt/nodeapp"),
        InitFile.fromFileInline(
          "/opt/nodeapp/index.js",
          "./test-service/index.js"
        ),
        InitFile.fromFileInline(
          "/opt/nodeapp/package.json",
          "./test-service/package.json"
        ),
        InitFile.fromFileInline(
          "/opt/nodeapp/package-lock.json",
          "./test-service/package-lock.json"
        ),
        InitCommand.shellCommand("npm i", { cwd: "/opt/nodeapp" }),
        InitFile.fromFileInline(
          "/etc/systemd/system/test-service.service",
          "./test-service/test-service.service"
        ),
        InitService.enable("test-service", { enabled: true })
      ),
    });
  }
}
