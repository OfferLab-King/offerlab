import postgres from "postgres";

import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import {
  createHttpClient,
  fetchText,
} from "../../src/modules/job-catalog/infrastructure/connectors/http-client";
import { RobotsGate } from "../../src/modules/job-catalog/infrastructure/connectors/robots";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

/**
 * Auto-derives and live-verifies Workday CXS endpoints for sources that lack
 * connector configuration.
 *
 * The Workday public Recruiting API endpoint follows the pattern
 *   https://<host>/wday/cxs/<tenant>/<site>/jobs
 * where <tenant> is the subdomain of the careers URL and <site> is its path
 * segment. Derivation is a hypothesis: each candidate is verified with a real
 * bounded POST (limit 1) before --confirm writes it into the source
 * configuration. Sources whose endpoint cannot be verified are reported for
 * manual review and left unchanged.
 */
loadLocalEnvironment();

const dryRun = !process.argv.includes("--confirm");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to run: DATABASE_MIGRATION_URL must use an approved local database host.",
  );
}

const configuration = readCrawlerConfiguration(process.env);
const httpClient = createHttpClient({
  timeoutMs: configuration.timeoutMs,
  userAgent: configuration.userAgent,
});
const robotsGate = new RobotsGate({ httpClient });
const database = postgres(databaseUrl, { max: 2, prepare: false });

const LOCALE_SEGMENT = /^[a-z]{2}(?:-[A-Z]{2})?$/u;

function deriveWorkdayEndpoints(careersUrl: string): readonly string[] {
  const url = new URL(careersUrl);
  const host = url.host;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];
  const tenant = host.split(".")[0] ?? "";
  const nonLocaleSegments = segments.filter((segment) => !LOCALE_SEGMENT.test(segment));
  const site = nonLocaleSegments[nonLocaleSegments.length - 1] ?? segments[0];
  if (!tenant || !site) return [];
  return [`https://${host}/wday/cxs/${tenant}/${site}/jobs`];
}

async function verifyEndpoint(endpoint: string): Promise<{ jobs: number } | { error: string }> {
  const decision = await robotsGate.check(endpoint, "offerlab");
  if (decision === "blocked") return { error: "robots_blocked" };
  try {
    const response = await fetchText(endpoint, {
      httpClient,
      method: "POST",
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
      headers: { "content-type": "application/json" },
      retryable: false,
    });
    if (response.status < 200 || response.status >= 300) {
      return { error: `http_${response.status}` };
    }
    const parsed = JSON.parse(response.body) as { total?: unknown };
    if (typeof parsed.total !== "number") return { error: "not_json_api" };
    return { jobs: parsed.total };
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 120) : "unknown_error" };
  }
}

try {
  const sources = await database<
    {
      id: string;
      slug: string;
      careers_url: string;
      configuration: Readonly<Record<string, unknown>>;
    }[]
  >`
    select id, slug, careers_url, configuration
    from app.job_source
    where source_type = 'workday'
      and configuration is not null
  `;

  const pending = sources.filter(
    (source) =>
      typeof source.configuration.cxsEndpoint !== "string" &&
      typeof source.configuration.raasEndpoint !== "string",
  );
  process.stdout.write(
    `${sources.length} workday sources, ${pending.length} missing connector configuration.\n`,
  );

  let configured = 0;
  let failed = 0;
  for (const source of pending) {
    const candidates = deriveWorkdayEndpoints(source.careers_url);
    let outcome: { jobs: number } | { error: string } = { error: "no_candidates" };
    let verifiedEndpoint: string | null = null;
    for (const candidate of candidates) {
      outcome = await verifyEndpoint(candidate);
      if ("jobs" in outcome) {
        verifiedEndpoint = candidate;
        break;
      }
    }
    if (!verifiedEndpoint) {
      failed += 1;
      process.stdout.write(
        `  [needs review] ${source.slug}: ${"error" in outcome ? outcome.error : "no candidates"} ${source.careers_url}\n`,
      );
      continue;
    }
    const verifiedJobs = "jobs" in outcome ? outcome.jobs : 0;
    process.stdout.write(
      `  [verified] ${source.slug}: ${verifiedEndpoint} (${verifiedJobs} jobs)\n`,
    );
    if (dryRun) continue;
    await database`
      update app.job_source
      set configuration = configuration || jsonb_build_object('cxsEndpoint', ${verifiedEndpoint}::text),
          updated_at = now()
      where id = ${source.id}::uuid
    `;
    configured += 1;
  }

  process.stdout.write(
    dryRun
      ? `Dry run: ${failed} need review. Re-run with --confirm to write the verified endpoints.\n`
      : `Configured ${configured} sources; ${failed} need manual review.\n`,
  );
} finally {
  await database.end();
}
