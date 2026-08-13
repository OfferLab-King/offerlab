import postgres from "postgres";

import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import {
  createHttpClient,
  fetchText,
} from "../../src/modules/job-catalog/infrastructure/connectors/http-client";
import { RobotsGate } from "../../src/modules/job-catalog/infrastructure/connectors/robots";
import {
  applyCandidateFingerprintPlans,
  applyCandidatePromotions,
  formatDiscoveryReport,
  planCandidatePromotions,
  planDiscoveryFingerprints,
} from "../../src/modules/employer-research/application/source-discovery";
import { listDiscoveryCandidates } from "../../src/modules/employer-research/infrastructure/discovery-repository";
import { markCandidateVerified } from "../../src/modules/employer-research/infrastructure/discovery-repository";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

function readFlag(name: string): string | undefined {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  return argument?.split("=").slice(1).join("=");
}

const company = readFlag("company") ?? null;
const tier = readFlag("tier") ?? null;
const platformFilter = readFlag("platform") ?? null;
const statusFilter = readFlag("status") ?? null;
const rawLimit = Number(readFlag("limit") ?? "500");
if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 500) {
  throw new Error("--limit must be an integer between 1 and 500");
}
const dryRun = !process.argv.includes("--confirm");
const verify = process.argv.includes("--verify");
const promote = process.argv.includes("--promote");

const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("Refusing to run discovery: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to run discovery: DATABASE_MIGRATION_URL must use an approved local database host.",
  );
}

const configuration = readCrawlerConfiguration(process.env);
const database = postgres(databaseUrl, { max: 2, prepare: false });

const httpClient = createHttpClient({
  timeoutMs: configuration.timeoutMs,
  userAgent: configuration.userAgent,
});
const robotsGate = new RobotsGate({ httpClient });

const report = await database.begin(async (transaction) => {
  const candidates = await listDiscoveryCandidates(transaction, {
    companySlug: company,
    tier,
    platform: platformFilter,
    status: statusFilter,
    search: null,
    limit: rawLimit,
  });

  if (candidates.length === 0) {
    return "no-candidates";
  }

  const fingerprintPlans = planDiscoveryFingerprints(candidates);
  const fingerprintOutcome = await applyCandidateFingerprintPlans(
    transaction,
    fingerprintPlans,
    !dryRun,
  );

  let verifiedCount = 0;
  let verifyFailures = 0;
  if (verify) {
    for (const plan of fingerprintPlans) {
      if (dryRun) {
        process.stdout.write(
          `  [verify dry-run] ${plan.companyName}: ${plan.url} -> ${plan.fingerprint.platform}\n`,
        );
        continue;
      }
      const decision = await robotsGate.check(plan.url, "offerlab");
      if (decision === "blocked") {
        process.stdout.write(`  [robots blocked] ${plan.companyName}: ${plan.url}\n`);
        continue;
      }
      try {
        const response = await fetchText(plan.url, {
          httpClient,
          retryable: false,
        });
        if (response.status < 400) {
          await markCandidateVerified(transaction, plan.candidateId, response.url);
          verifiedCount += 1;
        } else {
          verifyFailures += 1;
          process.stdout.write(
            `  [verify failed] ${plan.companyName}: HTTP ${response.status} ${plan.url}\n`,
          );
        }
      } catch (error) {
        verifyFailures += 1;
        const reason = error instanceof Error ? error.message : "unknown error";
        process.stdout.write(`  [verify failed] ${plan.companyName}: ${reason}\n`);
      }
    }
  }

  const promotions = planCandidatePromotions(candidates);
  if (!promote) {
    const promotable = promotions.filter((plan) => plan.promotable).length;
    if (promotable > 0) {
      process.stdout.write(
        `\n${promotable} candidate(s) are verified and promotable; re-run with --promote to create paused sources.\n`,
      );
    }
  }

  const promotionOutcome = await applyCandidatePromotions(
    transaction,
    promotions,
    !dryRun && promote,
  );

  return {
    fingerprintPlans,
    fingerprintOutcome,
    promotions,
    promotionOutcome,
    verifiedCount,
    verifyFailures,
  };
});

try {
  if (report === "no-candidates") {
    process.stdout.write("\nNo source-discovery candidates match the filters.\n");
  } else {
    process.stdout.write(
      formatDiscoveryReport(
        report.fingerprintPlans,
        report.fingerprintOutcome,
        report.promotions,
        report.promotionOutcome,
        dryRun,
      ),
    );
    process.stdout.write("\n");
    if (verify && !dryRun) {
      process.stdout.write(
        `Verification: ${report.verifiedCount} verified, ${report.verifyFailures} failed.\n`,
      );
    }
    if (dryRun) {
      process.stdout.write("Dry run - no writes. Re-run with --confirm to apply.\n");
    }
  }
} finally {
  await database.end();
}
