import { DnsValidatedCertificate } from "@aws-cdk/aws-certificatemanager";
import {
  CaaAmazonRecord,
  IHostedZone,
  PublicHostedZone,
} from "@aws-cdk/aws-route53";
import { Construct, Duration, Environment, Stack } from "@aws-cdk/core";
import { parentZoneId } from "./config";

export class PublicDnsStack extends Stack {
  readonly zone: IHostedZone;
  readonly certificate: DnsValidatedCertificate;
  readonly caaRecord: CaaAmazonRecord;

  constructor(
    scope: Construct,
    env: Required<Environment>,
    tags: { [key: string]: string }
  ) {
    super(scope, "AlexLnD-DnsStack", { env, tags });

    this.zone = PublicHostedZone.fromHostedZoneAttributes(
      this,
      "AlexHostedZone",
      { hostedZoneId: parentZoneId, zoneName: "aws.alexswilliams.co.uk" }
    );

    this.caaRecord = new CaaAmazonRecord(this, "CaaRecord", {
      zone: this.zone,
      recordName: "aws.alexswilliams.co.uk",
      ttl: Duration.seconds(60),
    });

    this.certificate = new DnsValidatedCertificate(this, "Cert", {
      domainName: "*.aws.alexswilliams.co.uk",
      hostedZone: this.zone,
    });
    this.certificate.node.addDependency(this.caaRecord);
  }
}
