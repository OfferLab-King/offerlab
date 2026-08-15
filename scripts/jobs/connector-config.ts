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
 * Auto-derives and live-verifies connector configuration for every supported
 * ATS platform, then writes it with --confirm.
 *
 * Each platform exposes a public JSON API whose identifier is derivable from
 * the source's careers URL (subdomain or path segment). Derivation is a
 * hypothesis: every candidate is verified with a real bounded request before
 * it is written. Sources whose endpoint cannot be verified (and platforms
 * with no typed connector, e.g. iCIMS/custom) are reported for manual review
 * and left unchanged.
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

type PlatformRule = Readonly<{
  configKey: string;
  sourceTypes: readonly string[];
  derive: (careersUrl: string) => readonly { key: string; verifyUrl: string }[];
  verifyOk: (status: number, body: string) => boolean;
}>;

const GREENHOUSE = "greenhouse" as const;
const LEVER = "lever" as const;
const ASHBY = "ashby" as const;
const SMARTRECRUITERS = "smartrecruiters" as const;
const WORKABLE = "workable" as const;
const TEAMTAILOR = "teamtailor" as const;

const platformRules: readonly PlatformRule[] = [
  {
    configKey: "workableAccount",
    sourceTypes: [WORKABLE],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      // The account is the first path segment (apply.workable.com/<account>);
      // the host is shared across all accounts.
      const account = segments[0] ?? null;
      if (!account) return [];
      return [
        {
          key: account,
          verifyUrl: `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}`,
        },
      ];
    },
    verifyOk: (status, body) =>
      status >= 200 && status < 300 && Array.isArray(JSON.parse(body).jobs),
  },
  {
    configKey: "teamtailorCompany",
    sourceTypes: [TEAMTAILOR],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const company = url.host.split(".")[0] ?? null;
      if (!company) return [];
      return [
        {
          key: company,
          verifyUrl: `https://${encodeURIComponent(company)}.teamtailor.com/jobs.json`,
        },
      ];
    },
    verifyOk: (status, body) =>
      status >= 200 && status < 300 && Array.isArray(JSON.parse(body).items),
  },
  {
    configKey: "greenhouseBoardToken",
    sourceTypes: [GREENHOUSE],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const token = url.host.endsWith(".boards.greenhouse.io")
        ? url.host.split(".")[0]
        : (segments[0] ?? null);
      if (!token) return [];
      return [
        {
          key: token,
          verifyUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?per_page=1`,
        },
      ];
    },
    verifyOk: (status, body) =>
      status >= 200 && status < 300 && Array.isArray(JSON.parse(body).jobs),
  },
  {
    configKey: "leverCompany",
    sourceTypes: [LEVER],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const company = segments[0] ?? null;
      if (!company) return [];
      return [
        {
          key: company,
          verifyUrl: `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
        },
      ];
    },
    verifyOk: (status, body) => status >= 200 && status < 300 && Array.isArray(JSON.parse(body)),
  },
  {
    configKey: "ashbyOrg",
    sourceTypes: [ASHBY],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const org = segments[0] ?? null;
      if (!org) return [];
      return [
        {
          key: org,
          verifyUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`,
        },
      ];
    },
    verifyOk: (status, body) => status >= 200 && status < 300 && Boolean(JSON.parse(body).jobs),
  },
  {
    configKey: "smartRecruitersCompany",
    sourceTypes: [SMARTRECRUITERS],
    derive: (careersUrl) => {
      const url = new URL(careersUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const company = segments[0] ?? null;
      if (!company) return [];
      return [
        {
          key: company,
          verifyUrl: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=1`,
        },
      ];
    },
    verifyOk: (status, body) => status >= 200 && status < 300 && Boolean(JSON.parse(body).content),
  },
];

function deriveWorkdayEndpoints(careersUrl: string): readonly string[] {
  const url = new URL(careersUrl);
  const host = url.host;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];
  const tenant = host.split(".")[0] ?? "";
  const nonLocaleSegments = segments.filter(
    (segment) => !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(segment),
  );
  const site = nonLocaleSegments[nonLocaleSegments.length - 1] ?? segments[0];
  if (!tenant || !site) return [];
  return [`https://${host}/wday/cxs/${tenant}/${site}/jobs`];
}

async function verifyUrl(
  url: string,
  method: "GET" | "POST",
): Promise<{ ok: boolean; note: string }> {
  const decision = await robotsGate.check(url, "offerlab");
  if (decision === "blocked") return { ok: false, note: "robots_blocked" };
  try {
    const response = await fetchText(
      url,
      method === "POST"
        ? {
            httpClient,
            method: "POST",
            body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
            headers: { "content-type": "application/json" },
            retryable: false,
          }
        : { httpClient, retryable: false },
    );
    return { ok: response.status >= 200 && response.status < 300, note: `http_${response.status}` };
  } catch (error) {
    return {
      ok: false,
      note: error instanceof Error ? error.message.slice(0, 120) : "unknown_error",
    };
  }
}

try {
  const sources = await database<
    {
      id: string;
      slug: string;
      source_type: string;
      careers_url: string;
      configuration: Readonly<Record<string, unknown>>;
    }[]
  >`
    select id, slug, source_type, careers_url, configuration
    from app.job_source
  `;

  const pending = sources.filter((source) => Object.keys(source.configuration).length === 0);
  const configured = new Set<string>();
  let failed = 0;

  for (const source of pending) {
    if (source.source_type === "workday") {
      const endpoints = deriveWorkdayEndpoints(source.careers_url);
      let written: string | null = null;
      for (const endpoint of endpoints) {
        const result = await verifyUrl(endpoint, "POST");
        if (result.ok) {
          written = endpoint;
          break;
        }
      }
      if (written) {
        configured.add("workday");
        process.stdout.write(`  [verified] ${source.slug}: ${written}\n`);
        if (!dryRun) {
          await database`
            update app.job_source
            set configuration = configuration || jsonb_build_object('cxsEndpoint', ${written}::text),
                updated_at = now()
            where id = ${source.id}::uuid
          `;
        }
      } else {
        failed += 1;
        process.stdout.write(`  [needs review] ${source.slug}: ${source.careers_url}\n`);
      }
      continue;
    }

    const rule = platformRules.find((candidate) =>
      candidate.sourceTypes.includes(source.source_type),
    );
    if (!rule) {
      failed += 1;
      process.stdout.write(
        `  [unsupported] ${source.slug}: source_type ${source.source_type} has no typed connector (${source.careers_url})\n`,
      );
      continue;
    }
    const candidates = rule.derive(source.careers_url);
    let verifiedKey: string | null = null;
    let lastNote = "no_candidates";
    for (const candidate of candidates) {
      const result = await verifyUrl(candidate.verifyUrl, "GET");
      if (result.ok) {
        try {
          const probe = await fetchText(candidate.verifyUrl, { httpClient, retryable: false });
          if (rule.verifyOk(probe.status, probe.body)) {
            verifiedKey = candidate.key;
            break;
          }
          lastNote = "not_platform_api";
        } catch {
          lastNote = "probe_failed";
        }
      } else {
        lastNote = result.note;
      }
    }
    if (!verifiedKey) {
      failed += 1;
      process.stdout.write(`  [needs review] ${source.slug}: ${lastNote} ${source.careers_url}\n`);
      continue;
    }
    configured.add(rule.configKey);
    process.stdout.write(`  [verified] ${source.slug}: ${rule.configKey}=${verifiedKey}\n`);
    if (dryRun) continue;
    await database`
      update app.job_source
      set configuration = configuration || jsonb_build_object(${rule.configKey}::text, ${verifiedKey}::text),
          updated_at = now()
      where id = ${source.id}::uuid
    `;
  }

  process.stdout.write(
    `\n${dryRun ? "Dry run: " : "Configured "}${[...configured].join(", ") || "nothing"}; ${failed} sources need review.\n` +
      (dryRun ? "Re-run with --confirm to write the verified configuration.\n" : ""),
  );
} finally {
  await database.end();
}
