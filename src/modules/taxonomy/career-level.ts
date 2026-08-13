/**
 * Canonical career-level taxonomy (Phase D preparation contract).
 * Career level is a filter dimension, never a publication gate: general and
 * experienced roles remain valid catalogue records.
 */

export const careerLevels = [
  "school_leaver",
  "student",
  "intern",
  "graduate",
  "entry_level",
  "junior",
  "experienced",
  "manager",
  "senior_leadership",
  "unknown",
] as const;

export type CareerLevelKey = (typeof careerLevels)[number];

export const careerLevelLabels: Readonly<Record<CareerLevelKey, string>> = {
  school_leaver: "School leaver",
  student: "Student",
  intern: "Intern",
  graduate: "Graduate",
  entry_level: "Entry level",
  junior: "Junior",
  experienced: "Experienced",
  manager: "Manager",
  senior_leadership: "Senior leadership",
  unknown: "Unknown",
};

export function careerLevelLabel(key: CareerLevelKey | string | null): string | null {
  if (!key) return null;
  return careerLevelLabels[key as CareerLevelKey] ?? null;
}
