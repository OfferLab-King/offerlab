export type PublicVisibilityInput = Readonly<{
  active: boolean;
  application_deadline: Date | null;
  eligibility_status: string;
  publication_status: string;
}>;

/**
 * The public visibility predicate shared by the listing, sitemap, detail page
 * and metadata generation. Only eligible, published, active roles with a
 * deadline that has not passed are publicly visible.
 */
export function isPubliclyVisible(job: PublicVisibilityInput, now: Date): boolean {
  if (
    !job.active ||
    job.publication_status !== "published" ||
    job.eligibility_status !== "eligible"
  ) {
    return false;
  }
  if (job.application_deadline && new Date(job.application_deadline).getTime() < now.getTime()) {
    return false;
  }
  return true;
}

/** JSON-LD escaping for safe embedding in a script tag (React dangerouslySetInnerHTML). */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}
