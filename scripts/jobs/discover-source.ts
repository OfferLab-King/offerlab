import postgres from "postgres";

import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import {
  createHttpClient,
  fetchText,
} from "../../src/modules/job-catalog/infrastructure/connectors/http-client";
import { RobotsGate } from "../../src/modules/job-catalog/infrastructure/connectors/robots";
import {
  deriveSourceAutomationCandidates,
  sourceAutomationProbeMatches,
} from "../../src/modules/employer-research/domain/source-automation";
import {
  applyCandidateFingerprintPlans,
  applyCandidatePromotions,
  formatDiscoveryReport,
  formatHomepageDiscoveryReport,
  planCandidatePromotions,
  planDiscoveryFingerprints,
  runHomepageCareersDiscovery,
} from "../../src/modules/employer-research/application/source-discovery";
import {
  listDiscoveryCandidates,
  listEmployersMissingCandidates,
} from "../../src/modules/employer-research/infrastructure/discovery-repository";
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
const rawOffset = Number(readFlag("offset") ?? "0");
if (!Number.isInteger(rawOffset) || rawOffset < 0) {
  throw new Error("--offset must be a non-negative integer");
}
const automate = process.argv.includes("--automate");
const dryRun = !automate && !process.argv.includes("--confirm");
const verify = automate || process.argv.includes("--verify");
const promote = automate || process.argv.includes("--promote");
const homepageDiscovery = process.argv.includes("--homepage");

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
    candidateId: null,
    companySlug: company,
    tier,
    platform: platformFilter,
    status: statusFilter,
    search: null,
    limit: rawLimit,
    offset: rawOffset,
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
  const verifiedCandidateIds = new Set<string>();
  const verifiedEndpoints = new Map<string, string>();
  if (verify) {
    for (const plan of fingerprintPlans) {
      const candidate = candidates.find((item) => item.candidateId === plan.candidateId)!;
      const automationPlans = deriveSourceAutomationCandidates(
        candidate.candidateUrl,
        candidate.candidateEndpoint,
        candidate.companyName,
      );
      if (automationPlans.length === 0) {
        process.stdout.write(
          `  [review required] ${plan.companyName}: no safe typed connector can be derived\n`,
        );
        verifyFailures += 1;
        continue;
      }
      let verified = false;
      let lastReason = "no matching provider response";
      for (const automationPlan of automationPlans) {
        const decision = await robotsGate.check(automationPlan.probe.url, "offerlab");
        if (decision === "blocked") {
          lastReason = "robots blocked";
          continue;
        }
        try {
          const response = await fetchText(automationPlan.probe.url, {
            httpClient,
            ...(automationPlan.probe.method === "POST"
              ? {
                  body: automationPlan.probe.body ?? "",
                  headers: { "content-type": "application/json" },
                  method: "POST" as const,
                }
              : {}),
            retryable: false,
          });
          if (!sourceAutomationProbeMatches(automationPlan, response.status, response.body)) {
            lastReason = `response did not match ${automationPlan.platform}`;
            continue;
          }
          await markCandidateVerified(
            transaction,
            plan.candidateId,
            `Typed ${automationPlan.platform} API verified at ${response.url}`,
            "typed_api_verified",
            automationPlan.crawlEndpointUrl,
          );
          verifiedCandidateIds.add(plan.candidateId);
          verifiedEndpoints.set(plan.candidateId, automationPlan.crawlEndpointUrl);
          verifiedCount += 1;
          verified = true;
          break;
        } catch (error) {
          lastReason = error instanceof Error ? error.message : "unknown error";
        }
      }
      if (!verified) {
        verifyFailures += 1;
        process.stdout.write(`  [verify failed] ${plan.companyName}: ${lastReason}\n`);
      }
    }
  }

  const promotions = planCandidatePromotions(
    candidates.map((candidate) =>
      verifiedCandidateIds.has(candidate.candidateId)
        ? {
            ...candidate,
            atsVerificationStatus: "typed_api_verified",
            candidateEndpoint:
              verifiedEndpoints.get(candidate.candidateId) ?? candidate.candidateEndpoint,
            status: "verified",
            verifiedAt: new Date(),
          }
        : candidate,
    ),
  );
  if (!promote) {
    const promotable = promotions.filter((plan) => plan.promotable).length;
    if (promotable > 0) {
      process.stdout.write(
        `\n${promotable} candidate(s) are verified and automatable; re-run with --automate to activate and queue them.\n`,
      );
    }
  }

  const promotionOutcome = await applyCandidatePromotions(
    transaction,
    promotions,
    !dryRun && promote,
  );

  let homepageOutcome = null;
  if (homepageDiscovery) {
    const employers = await listEmployersMissingCandidates(transaction, {
      tier,
      limit: rawLimit,
    });
    if (employers.length === 0) {
      process.stdout.write("\nNo P0/P1 employers are missing discovery candidates.\n");
    } else {
      homepageOutcome = await runHomepageCareersDiscovery(transaction, employers, {
        apply: !dryRun,
        checkRobots: (url) => robotsGate.check(url, "offerlab"),
        fetchHomepage: async (url) => {
          const response = await fetchText(url, { httpClient, retryable: false });
          return { body: response.body, finalUrl: response.url, status: response.status };
        },
      });
    }
  }

  return {
    fingerprintPlans,
    fingerprintOutcome,
    promotions,
    promotionOutcome,
    homepageOutcome,
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
    if (verify) {
      process.stdout.write(
        `Verification: ${report.verifiedCount} verified, ${report.verifyFailures} failed.\n`,
      );
    }
    if (dryRun) {
      process.stdout.write("Dry run - no writes. Re-run with --confirm to apply.\n");
    }
    if (report.homepageOutcome) {
      process.stdout.write(formatHomepageDiscoveryReport(report.homepageOutcome));
      process.stdout.write("\n");
    }
  }
} finally {
  await database.end();
}
