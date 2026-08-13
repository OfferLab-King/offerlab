export type EmployerIndexabilityEvidence = Readonly<{
  /** Whether the employer remains an active public catalogue entity. */
  active: boolean;
  /** Curated original OfferLab description, if an administrator or seed supplied one. */
  description: string | null;
  /** Whether any job has ever been imported for this employer (current or historical). */
  hasImportedJobs: boolean;
  /** Whether the source registry records official employer website or careers information. */
  hasOfficialEmployerInfo: boolean;
  /**
   * Whether the researched universe provides a credible structured profile:
   * a verified employer industry plus at least one of size, ownership or
   * Home Office sponsor evidence, with an official website/careers URL.
   */
  hasCredibleProfile: boolean;
}>;

/**
 * Deterministic policy deciding whether an employer profile has enough
 * factual value to be indexed. A profile qualifies through either a curated
 * original OfferLab description, catalogue evidence (current or historical
 * imported jobs plus official employer information), or a credible structured
 * research profile (verified industry plus size/ownership/sponsor evidence
 * and an official URL). Existence in the seed or directory list alone is
 * never enough, and no AI filler or invented claims can make a profile
 * indexable.
 */
export function isEmployerIndexable(evidence: EmployerIndexabilityEvidence): boolean {
  if (!evidence.active) return false;
  const hasCuratedDescription =
    evidence.description !== null && evidence.description.trim().length > 0;
  if (hasCuratedDescription) return true;
  if (evidence.hasImportedJobs && evidence.hasOfficialEmployerInfo) return true;
  return evidence.hasCredibleProfile;
}
