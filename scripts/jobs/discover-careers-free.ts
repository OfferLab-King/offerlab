import { Resolver } from "node:dns/promises";

import postgres from "postgres";

import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import {
  createHttpClient,
  fetchText,
} from "../../src/modules/job-catalog/infrastructure/connectors/http-client";
import { RobotsGate } from "../../src/modules/job-catalog/infrastructure/connectors/robots";
import { planHomepageCareersUrl } from "../../src/modules/employer-research/domain/careers-url-discovery";
import {
  channelFromCareersUrl,
  deriveOfficialHomepageCandidates,
  homepageHasEmployerIdentity,
} from "../../src/modules/employer-research/domain/free-web-discovery";
import {
  countSponsorEmployersMissingWebPresence,
  fillOfficialCompanyWebsite,
  listSponsorEmployersMissingWebPresence,
  recordEmployerWebDiscoveryAttempts,
  type EmployerWebDiscoveryAttemptWrite,
  type SponsorEmployerDiscoveryTarget,
  upsertDiscoveryCandidate,
} from "../../src/modules/employer-research/infrastructure/discovery-repository";
import {
  platformLabel,
  type AtsPlatform,
} from "../../src/modules/employer-research/domain/ats-fingerprint";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

function readInteger(name: string, fallback: number, maximum: number): number {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  const value = Number(argument?.split("=").slice(1).join("=") ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`--${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

const maxCompanies = readInteger("max-companies", 150_000, 150_000);
const concurrency = readInteger("concurrency", 40, 1_000);
const dnsPrefilter = process.argv.includes("--dns-prefilter");
const discoveryVersion = "dns-https-v1";
const provider = "dns_https" as const;

const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error("Free career discovery is limited to the approved local operations database.");
}

const crawler = readCrawlerConfiguration(process.env);
const httpClient = createHttpClient({
  maxResponseBytes: 1_000_000,
  retries: 0,
  timeoutMs: Math.min(crawler.timeoutMs, 7_000),
  userAgent: crawler.userAgent,
});
const robotsGate = new RobotsGate({ httpClient });
const database = postgres(databaseUrl, { max: Math.min(concurrency + 2, 30), prepare: false });
const resolvers = ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"].map((server) => {
  const resolver = new Resolver();
  resolver.setServers([server]);
  return resolver;
});
let resolverCursor = 0;

async function hostnameResolves(url: string): Promise<boolean> {
  try {
    const resolver = resolvers[resolverCursor % resolvers.length]!;
    resolverCursor += 1;
    await resolver.resolve4(new URL(url).hostname);
    return true;
  } catch {
    return false;
  }
}

let completed = 0;
let websites = 0;
let candidates = 0;
let noMatch = 0;
let blocked = 0;
let failures = 0;
const pendingAttempts: EmployerWebDiscoveryAttemptWrite[] = [];
let flushPromise = Promise.resolve();

async function queueAttempt(input: EmployerWebDiscoveryAttemptWrite): Promise<void> {
  pendingAttempts.push(input);
  if (pendingAttempts.length < 250) return;
  const batch = pendingAttempts.splice(0, 250);
  flushPromise = flushPromise.then(() => recordEmployerWebDiscoveryAttempts(database, batch));
  await flushPromise;
}

async function runDnsPrefilter(targets: readonly SponsorEmployerDiscoveryTarget[]): Promise<void> {
  let cursor = 0;
  let processed = 0;
  let noDomain = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      const target = targets[index];
      if (!target) return;
      const homepages = target.websiteUrl
        ? [target.websiteUrl]
        : deriveOfficialHomepageCandidates(target.companyName).slice(0, 2);
      const resolutions = await Promise.all(homepages.map(hostnameResolves));
      if (!resolutions.some(Boolean)) {
        noDomain += 1;
        await queueAttempt({
          companyId: target.companyId,
          discoveryVersion,
          provider,
          status: "no_safe_match",
          resultCount: 0,
          safeCandidateCount: 0,
        });
      }
      processed += 1;
      if (processed % 5_000 === 0 || processed === targets.length) {
        process.stdout.write(
          `DNS progress ${processed}/${targets.length}: ${noDomain} without a live candidate domain\n`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await flushPromise;
  await recordEmployerWebDiscoveryAttempts(database, pendingAttempts.splice(0));
  process.stdout.write(
    `DNS prefilter complete: ${processed} checked; ${noDomain} safely removed; ${processed - noDomain} retained for HTTPS verification.\n`,
  );
}

try {
  const queued = await countSponsorEmployersMissingWebPresence(
    database,
    discoveryVersion,
    provider,
  );
  const limit = Math.min(maxCompanies, queued);
  const targets = await listSponsorEmployersMissingWebPresence(database, {
    discoveryVersion,
    limit,
    provider,
  });
  process.stdout.write("\n== Free sponsor careers discovery ==\n");
  process.stdout.write(`queued: ${queued.toLocaleString("en-GB")}; this run: ${targets.length}\n`);
  process.stdout.write(`provider cost: $0; concurrency: ${concurrency}\n`);

  if (dnsPrefilter) {
    await runDnsPrefilter(targets);
  } else {
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        const target = targets[index];
        if (!target) return;
        let fetchedPages = 0;
        let verifiedHomepage: string | null = null;
        let discoveredCandidate = false;
        try {
          const homepageCandidates = target.websiteUrl
            ? [target.websiteUrl]
            : deriveOfficialHomepageCandidates(target.companyName).slice(0, 2);
          const probes = await Promise.all(
            homepageCandidates.map(async (homepageUrl) => {
              if (!(await hostnameResolves(homepageUrl))) return null;
              const robots = await robotsGate.check(homepageUrl, "offerlab");
              if (robots === "blocked") {
                blocked += 1;
                return null;
              }
              try {
                const response = await fetchText(homepageUrl, { httpClient, retryable: false });
                fetchedPages += 1;
                if (!homepageHasEmployerIdentity(target.companyName, response.url, response.body)) {
                  return null;
                }
                const careerPlan = planHomepageCareersUrl(response.body, response.url);
                if (!careerPlan && !target.websiteUrl) return null;
                return { careerPlan, response };
              } catch {
                return null;
              }
            }),
          );
          const accepted = probes.find((probe) => probe !== null) ?? null;
          if (accepted) {
            verifiedHomepage = accepted.response.url;
            if (accepted.careerPlan) {
              const careerPlan = accepted.careerPlan;
              if (!target.websiteUrl) {
                const websiteOutcome = await fillOfficialCompanyWebsite(
                  database,
                  target.companyId,
                  accepted.response.url,
                );
                if (websiteOutcome === "updated") websites += 1;
              }
              const outcome = await database.begin((transaction) =>
                upsertDiscoveryCandidate(transaction, {
                  companyId: target.companyId,
                  url: careerPlan.candidateUrl,
                  channel: channelFromCareersUrl(careerPlan.candidateUrl),
                  platformHint:
                    careerPlan.fingerprintPlatform === "unknown"
                      ? null
                      : platformLabel(careerPlan.fingerprintPlatform as AtsPlatform),
                  status: careerPlan.status,
                  discoveryMethod: "dns_https_homepage",
                  evidence: [
                    `Verified homepage identity at ${new URL(accepted.response.url).hostname}`,
                    ...careerPlan.evidence,
                  ],
                  notes:
                    "Zero-cost DNS/HTTPS discovery. Inactive until official-domain or typed ATS verification succeeds.",
                }),
              );
              discoveredCandidate = true;
              if (outcome === "inserted") candidates += 1;
            }
          }
          if (!verifiedHomepage) noMatch += 1;
          await queueAttempt({
            companyId: target.companyId,
            discoveryVersion,
            provider,
            status: verifiedHomepage ? "matched" : "no_safe_match",
            resultCount: fetchedPages,
            safeCandidateCount: discoveredCandidate ? 1 : 0,
          });
        } catch {
          failures += 1;
          await queueAttempt({
            companyId: target.companyId,
            discoveryVersion,
            provider,
            status: "failed",
            resultCount: fetchedPages,
            safeCandidateCount: 0,
          });
        } finally {
          completed += 1;
          if (completed % 250 === 0 || completed === targets.length) {
            process.stdout.write(
              `progress ${completed}/${targets.length}: websites ${websites}, careers ${candidates}, no safe match ${noMatch}, failures ${failures}\n`,
            );
          }
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await flushPromise;
    await recordEmployerWebDiscoveryAttempts(database, pendingAttempts.splice(0));
    process.stdout.write(
      `Complete: ${completed} checked; ${websites} websites; ${candidates} careers candidates; ${blocked} robots blocks; ${failures} retryable failures.\n`,
    );
  }
} finally {
  await database.end();
}
