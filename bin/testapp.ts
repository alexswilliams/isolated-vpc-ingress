import { MachineImage } from "@aws-cdk/aws-ec2";
import { App } from "@aws-cdk/core";
import { AlbAndApiGwStack } from "../lib/alb-and-api-gw";
import { webDevEnvironment as env } from "../lib/config";
import { PublicDnsStack } from "../lib/dns-and-certs";
import { IsolatedVpcStack } from "../lib/isolated-vpc";
import { AlbStack } from "../lib/load-balancers";
import { PrivateVpcStack } from "../lib/private-vpc";
import { PublicVpcStack } from "../lib/public-vpc";
import { TemplateEc2Stack } from "../lib/template-ec2";
import { TestApplicationConfig, TestEc2Stack } from "../lib/test-ec2";
import { VeryIsolatedVpcStack } from "../lib/very-isolated-vpc";

const app = new App();
const tags = { "test-project": "alex" };

const dns = new PublicDnsStack(app, env, tags);

() => {
  // To create the AMI, make this stack, and create an image from the running machine
  new TemplateEc2Stack(app, env, tags);
  // Manual step - take image of the above template EC2
};
const ami = MachineImage.genericLinux({ "eu-west-1": "ami-0d810ff56dabe3d0d" });

/**
 * Public Subnet (easy mode)
 */
(() => {
  const { vpc: vpc } = new PublicVpcStack(app, env, tags);

  const svc1 = new TestEc2Stack(app, "Service-A", env, tags, vpc, ami, true);
  const svc2 = new TestEc2Stack(app, "Service-B", env, tags, vpc, ami, true);

  const publicApplications: { [key: string]: TestApplicationConfig } = {};
  publicApplications["a.aws.alexswilliams.co.uk"] = svc1.application;
  publicApplications["b.aws.alexswilliams.co.uk"] = svc2.application;

  new AlbStack(
    app,
    "Public",
    env,
    tags,
    vpc,
    [dns.certificate],
    publicApplications,
    dns.zone
  );
})();

// /**
//  * Private Subnet (medium mode)
//  */
(() => {
  const { vpc: vpc } = new PrivateVpcStack(app, env, tags);

  const svc1 = new TestEc2Stack(app, "Service-C", env, tags, vpc, ami, false);
  const svc2 = new TestEc2Stack(app, "Service-D", env, tags, vpc, ami, false);

  const privateApplications: { [key: string]: TestApplicationConfig } = {};
  privateApplications["c.aws.alexswilliams.co.uk"] = svc1.application;
  privateApplications["d.aws.alexswilliams.co.uk"] = svc2.application;

  new AlbStack(
    app,
    "Private",
    env,
    tags,
    vpc,
    [dns.certificate],
    privateApplications,
    dns.zone
  );
})();

// /**
//  * Isolated Subnet (hard mode)
//  */
(() => {
  const { vpc: vpc } = new IsolatedVpcStack(app, env, tags);

  const svc1 = new TestEc2Stack(app, "Service-E", env, tags, vpc, ami, false);
  const svc2 = new TestEc2Stack(app, "Service-F", env, tags, vpc, ami, false);

  const isolatedApplications: { [key: string]: TestApplicationConfig } = {};
  isolatedApplications["e.aws.alexswilliams.co.uk"] = svc1.application;
  isolatedApplications["f.aws.alexswilliams.co.uk"] = svc2.application;

  new AlbStack(
    app,
    "Isolated",
    env,
    tags,
    vpc,
    [dns.certificate],
    isolatedApplications,
    dns.zone
  );
})();

// /**
//  * Isolated Subnet without Public Subnet (sid meier mode)
//  */
(() => {
  const { vpc: vpc } = new VeryIsolatedVpcStack(app, env, tags);

  const svc1 = new TestEc2Stack(app, "Service-G", env, tags, vpc, ami, false);
  const svc2 = new TestEc2Stack(app, "Service-H", env, tags, vpc, ami, false);

  const isolatedApplications: { [key: string]: TestApplicationConfig } = {};
  isolatedApplications["g"] = svc1.application;
  isolatedApplications["h"] = svc2.application;

  new AlbAndApiGwStack(
    app,
    "VeryIsolated",
    env,
    tags,
    vpc,
    isolatedApplications,
    dns.zone,
    "gateway.aws.alexswilliams.co.uk",
    dns.certificate
  );
})();
