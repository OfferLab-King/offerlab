import { upsertCompany, type CompanySeedInput } from "../infrastructure/company-repository";
import { upsertJobSource, type JobSourceWrite } from "../infrastructure/job-source-repository";
import { employerManifest, MANIFEST_VERSION, type ManifestCompany } from "./employer-cohort";

/**
 * Imports the versioned UK-relevant employer cohort idempotently.
 *
 * Only endpoints whose verification is currently `verified` are imported as
 * active sources. `stale` and `unverified` endpoints import as PAUSED and are
 * never activated by an import. Existing sources keep their status and any
 * administrator URL/configuration overrides (the repository preserves
 * `manually_overridden` values and never rewrites `status` on conflict).
 */
export function jobSourceInputFor(company: ManifestCompany, companyId: string): JobSourceWrite {
  return {
    ...(company.atsProvider !== undefined ? { atsProvider: company.atsProvider } : {}),
    careersUrl: company.careersUrl,
    channel: "general",
    companyId,
    configuration: company.configuration,
    ...(company.crawlFrequencyMinutes !== undefined
      ? { crawlFrequencyMinutes: company.crawlFrequencyMinutes }
      : {}),
    name: "All careers",
    notes: company.verification.notes,
    slug: "all-careers",
    sourceType: company.sourceType,
    status: company.verification.status === "verified" ? "active" : "paused",
    verificationDate: new Date(`${company.verification.date}T00:00:00.000Z`),
    ...(company.verification.evidenceUrl
      ? { verificationEvidenceUrl: company.verification.evidenceUrl }
      : {}),
    manifestVersion: MANIFEST_VERSION,
  };
}

export function directoryPriorityRankFor(index: number): number {
  return (index + 1) * 10;
}

export async function seedInitialCohort(
  database: Parameters<typeof upsertCompany>[0],
): Promise<readonly { id: string; slug: string; name: string }[]> {
  const created: { id: string; slug: string; name: string }[] = [];
  for (const company of employerManifest) {
    const companyInput: CompanySeedInput = {
      atsProvider: company.atsProvider ?? null,
      careersUrl: company.careersUrl,
      configuration: company.configuration,
      crawlFrequencyMinutes: company.crawlFrequencyMinutes,
      industry: company.industry,
      name: company.name,
      notes: company.verification.notes,
      slug: company.slug,
      sourceType: company.sourceType,
      websiteUrl: company.websiteUrl,
    };
    const id = await upsertCompany(database, {
      ...companyInput,
      directoryPriorityRank: directoryPriorityRankFor(
        employerManifest.findIndex((entry) => entry.slug === company.slug),
      ),
      directorySectorKey: company.directorySectorKey,
      directoryVisible: true,
    });
    await upsertJobSource(database, jobSourceInputFor(company, id));
    created.push({ id, name: company.name, slug: company.slug });
  }
  return created;
}
