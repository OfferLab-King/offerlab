import { createHash } from "node:crypto";

export const JOB_CONTENT_HASH_VERSION = 1;

export type CanonicalJobContent = Readonly<{
  title: string;
  locationText: string | null;
  descriptionText: string | null;
  employmentType: string | null;
  remoteType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  applicationDeadline: string | null;
  applicationUrl: string | null;
  postedAt: string | null;
  externalJobId: string | null;
}>;

function normalized(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\u00a0/gu, " ");
  return trimmed.length > 0 ? trimmed : null;
}

function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function canonicalJobContent(input: CanonicalJobContent): string {
  const parts: unknown[] = [
    JOB_CONTENT_HASH_VERSION,
    normalized(input.title),
    normalized(input.locationText),
    normalized(input.descriptionText),
    normalized(input.employmentType),
    normalized(input.remoteType),
    input.salaryMin ?? null,
    input.salaryMax ?? null,
    normalized(input.salaryCurrency),
    normalized(input.salaryPeriod),
    input.applicationDeadline ? isoOrNull(input.applicationDeadline) : null,
    normalized(input.applicationUrl),
    input.postedAt ? isoOrNull(input.postedAt) : null,
    normalized(input.externalJobId),
  ];
  return JSON.stringify(parts);
}

export function hashJobContent(input: CanonicalJobContent): string {
  return createHash("sha256").update(canonicalJobContent(input)).digest("hex");
}
