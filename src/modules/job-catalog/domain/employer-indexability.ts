export type EmployerIndexabilityEvidence = Readonly<{
  /** Whether the employer remains an active public catalogue entity. */
  active: boolean;
  /** Curated original OfferLab description, if an administrator or seed supplied one. */
  description: string | null;
  /** Whether any job has ever been imported for this employer (current or historical). */
  hasImportedJobs: boolean;
  /** Whether the source registry records official employer website or careers information. */
  hasOfficialEmployerInfo: boolean;
}>;

/**
 * Deterministic policy deciding whether an employer profile has enough
 * factual value to be indexed. A profile qualifies through either a curated
 * original OfferLab description, or evidence that the employer has had
 * catalogue data (current or historical imported jobs) plus official employer
 * information. Existence in the seed or directory list alone is never enough,
 * and no AI filler or invented claims can make a profile indexable.
 */
export function isEmployerIndexable(evidence: EmployerIndexabilityEvidence): boolean {
  if (!evidence.active) return false;
  const hasCuratedDescription =
    evidence.description !== null && evidence.description.trim().length > 0;
  if (hasCuratedDescription) return true;
  return evidence.hasImportedJobs && evidence.hasOfficialEmployerInfo;
}
