import { z } from "zod";

export const learningPathSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type LearningPathItemInput = Readonly<{
  contextNote: string;
  resourceId: string;
}>;
export type LearningPathSectionInput = Readonly<{
  description: string;
  heading: string;
  items: readonly LearningPathItemInput[];
}>;
export type LearningPathDraftInput = Readonly<{
  introduction: string;
  primaryCategoryId: string | null;
  sections: readonly LearningPathSectionInput[];
  shortDescription: string;
  slug: string;
  title: string;
}>;

const text = (limit: number) =>
  z
    .string()
    .transform((value) => value.normalize("NFC").trim())
    .pipe(z.string().max(limit));
const itemSchema = z.object({ contextNote: text(500), resourceId: z.uuid() }).strict();
const sectionSchema = z
  .object({
    description: text(500),
    heading: text(120),
    items: z.array(itemSchema).max(50),
  })
  .strict();
export const learningPathDraftSchema = z
  .object({
    introduction: text(50_000),
    primaryCategoryId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
    sections: z.array(sectionSchema).max(30),
    shortDescription: text(500),
    slug: text(120).refine(
      (value) => learningPathSlug.test(value),
      "Use a lower-case hyphenated slug.",
    ),
    title: text(160),
  })
  .strict();

export function duplicateResourceIds(sections: readonly LearningPathSectionInput[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const section of sections)
    for (const item of section.items) {
      if (seen.has(item.resourceId)) duplicates.add(item.resourceId);
      seen.add(item.resourceId);
    }
  return [...duplicates];
}

export function publicationErrors(input: LearningPathDraftInput): readonly string[] {
  const errors: string[] = [];
  if (!input.title) errors.push("A title is required.");
  if (!input.shortDescription) errors.push("A description is required.");
  if (!input.sections.length) errors.push("At least one section is required.");
  if (input.sections.some((section) => !section.heading))
    errors.push("Every section needs a heading.");
  if (input.sections.some((section) => !section.items.length))
    errors.push("Every section needs a resource.");
  if (duplicateResourceIds(input.sections).length)
    errors.push("A resource can appear only once in a path.");
  return errors;
}

export function calculateProgress(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

export function firstIncomplete<T extends { completedAt: Date | null }>(items: readonly T[]) {
  return items.find((item) => !item.completedAt) ?? null;
}

export function pathsEqual(a: LearningPathDraftInput, b: LearningPathDraftInput) {
  return JSON.stringify(a) === JSON.stringify(b);
}
