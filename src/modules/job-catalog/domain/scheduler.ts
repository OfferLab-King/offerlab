export const DEFAULT_CRAWL_JITTER_RATIO = 0.1;

export function isSourceDue(company: Readonly<{ nextCheckAt: Date | null }>, now: Date): boolean {
  return company.nextCheckAt === null || company.nextCheckAt.getTime() <= now.getTime();
}

export function nextCheckAtWithJitter(
  frequencyMinutes: number,
  now: Date,
  jitterRatio = DEFAULT_CRAWL_JITTER_RATIO,
): Date {
  const baseMs = frequencyMinutes * 60_000;
  const jitter = baseMs * jitterRatio;
  const offset = baseMs - jitter + Math.random() * 2 * jitter;
  return new Date(now.getTime() + offset);
}

export function sortDueSources<T extends { nextCheckAt: Date | null }>(
  companies: readonly T[],
): T[] {
  return [...companies].sort((a, b) => {
    if (a.nextCheckAt === null && b.nextCheckAt === null) return 0;
    if (a.nextCheckAt === null) return -1;
    if (b.nextCheckAt === null) return 1;
    return a.nextCheckAt.getTime() - b.nextCheckAt.getTime();
  });
}
