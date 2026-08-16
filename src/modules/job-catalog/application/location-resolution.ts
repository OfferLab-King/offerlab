import type { TransactionSql } from "postgres";

import type { DiscoveredLocation } from "../domain/deduplication";
import { classifyDiscoveredJob } from "./classification-pipeline";
import type { WorkdayDetailFetchContext } from "../infrastructure/connectors/workday-detail";
import { resolveWorkdayDetailLocations } from "../infrastructure/connectors/workday-detail";
import { withCrawlerRole } from "../infrastructure/crawler-database";

export type LocationResolutionOutcome =
  "uk_confirmed" | "non_uk" | "ambiguous" | "no_locations" | "fetch_failed" | "admin_owned";

export type LocationResolutionReport = Readonly<{
  processed: number;
  outcomes: Readonly<Record<LocationResolutionOutcome, number>>;
  published: number;
  suppressed: number;
}>;

type PendingLocationRow = Readonly<{
  id: string;
  title: string;
  description_text: string | null;
  location_text: string;
  remote_type: string | null;
  application_deadline: Date | null;
  application_url: string;
  classification_source: string;
}>;

export async function listPendingLocationResolutions(
  database: TransactionSql,
  limit: number,
): Promise<readonly PendingLocationRow[]> {
  return database<PendingLocationRow[]>`
    select j.id, j.title, j.description_text, j.location_text, j.remote_type,
      j.application_deadline, j.application_url, j.classification_source
    from app.job j
    where j.active
      and j.eligibility_status = 'needs_review'
      and 'location_ambiguous' = any(j.eligibility_reasons)
      and j.application_url like '%myworkdayjobs.com%'
    order by j.updated_at asc
    limit ${limit}
  `;
}

export async function runLocationResolution(options: {
  dryRun: boolean;
  limit: number;
  httpClient: WorkdayDetailFetchContext["httpClient"];
  robotsGate: WorkdayDetailFetchContext["robotsGate"];
  now?: Date;
}): Promise<LocationResolutionReport> {
  const now = options.now ?? new Date();
  const outcomes: Record<LocationResolutionOutcome, number> = {
    admin_owned: 0,
    ambiguous: 0,
    fetch_failed: 0,
    no_locations: 0,
    non_uk: 0,
    uk_confirmed: 0,
  };
  let published = 0;
  let suppressed = 0;
  let processed = 0;

  const rows = await withCrawlerRole((database) =>
    listPendingLocationResolutions(database, options.limit),
  );

  const queue = [...rows];
  const workers = Array.from(
    { length: Math.min(4, queue.length) },
    () => async (): Promise<void> => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) return;
        if (row.classification_source === "administrator") {
          outcomes.admin_owned += 1;
          continue;
        }
        let resolution: {
          locations: readonly DiscoveredLocation[];
          sourceText: string;
        };
        try {
          resolution = await resolveWorkdayDetailLocations(row.application_url, {
            httpClient: options.httpClient,
            robotsGate: options.robotsGate,
          });
        } catch {
          outcomes.fetch_failed += 1;
          continue;
        }
        if (resolution.locations.length === 0) {
          outcomes.no_locations += 1;
          continue;
        }

        const classification = classifyDiscoveredJob({
          applicationDeadline: row.application_deadline,
          applicationUrl: row.application_url,
          descriptionText: row.description_text ?? "",
          employmentType: null,
          externalJobId: null,
          locationText: resolution.sourceText,
          locations: resolution.locations,
          postedAt: null,
          remoteType: row.remote_type,
          salaryCurrency: null,
          salaryMax: null,
          salaryMin: null,
          salaryPeriod: null,
          sourcePayload: {},
          sourceUrl: row.application_url,
          title: row.title,
        });

        const outcome: LocationResolutionOutcome =
          classification.eligibilityStatus === "eligible"
            ? "uk_confirmed"
            : classification.eligibilityStatus === "ineligible"
              ? "non_uk"
              : "ambiguous";
        outcomes[outcome] += 1;
        if (classification.publicationStatus === "published") published += 1;
        if (classification.publicationStatus === "suppressed") suppressed += 1;
        processed += 1;

        if (options.dryRun) continue;
        await withCrawlerRole((database) =>
          applyLocationResolution(database, row.id, resolution, classification, now),
        );
      }
    },
  );
  await Promise.all(workers.map((worker) => worker()));

  return { outcomes, processed, published, suppressed };
}

async function applyLocationResolution(
  database: TransactionSql,
  jobId: string,
  resolution: { locations: readonly DiscoveredLocation[]; sourceText: string },
  classification: ReturnType<typeof classifyDiscoveredJob>,
  now: Date,
): Promise<void> {
  await database`
    update app.job
    set eligibility_status = ${classification.eligibilityStatus},
        eligibility_reasons = ${database.array([...classification.eligibilityReasons])},
        eligibility_evidence = ${classification.eligibilityEvidence},
        publication_status = ${classification.publicationStatus},
        location_text = ${resolution.sourceText.slice(0, 500)},
        classification_source = 'deterministic',
        classification_version = classification_version + 1,
        last_changed_at = ${now},
        updated_at = now()
    where id = ${jobId}::uuid
  `;
  await database`delete from app.job_location where job_id = ${jobId}::uuid`;
  for (const [position, location] of resolution.locations.entries()) {
    await database`
      insert into app.job_location (
        job_id, city, region, country, remote, hybrid, on_site, source_text, position
      ) values (
        ${jobId}::uuid, ${location.city}, ${location.region}, ${location.country},
        ${location.remote}, ${location.hybrid}, ${location.onSite},
        ${location.sourceText}, ${position}
      )
    `;
  }
}
