export const DEFAULT_CRAWL_JITTER_RATIO = 0.1;

export function isSourceDue(
  source: Readonly<{ nextCheckAt: Date | null; runRequestedAt?: Date | null }>,
  now: Date,
): boolean {
  return (
    (source.runRequestedAt !== null && source.runRequestedAt !== undefined) ||
    source.nextCheckAt === null ||
    source.nextCheckAt.getTime() <= now.getTime()
  );
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

/**
 * After a failed crawl, either keeps the normal frequency (ordinary failures)
 * or backs off exponentially (2, 4, 8, ... hours, capped at 24) when the
 * failure looks like rate limiting or a throttled origin (429s, 5xx,
 * timeouts). The backoff lets throttles such as Workday's clear before the
 * worker probes the source again. Manual run requests still bypass the
 * schedule.
 */
export function nextCheckAfterFailure(
  options: Readonly<{
    crawlFrequencyMinutes: number;
    consecutiveFailures: number;
    now: Date;
    throttleLike: boolean;
  }>,
): Date {
  if (!options.throttleLike) {
    return nextCheckAtWithJitter(options.crawlFrequencyMinutes, options.now);
  }
  const hours = Math.min(2 ** options.consecutiveFailures, 24);
  return new Date(options.now.getTime() + hours * 3_600_000);
}

export function sortDueSources<
  T extends { nextCheckAt: Date | null; runRequestedAt?: Date | null },
>(companies: readonly T[]): T[] {
  return [...companies].sort((a, b) => {
    if (a.runRequestedAt && !b.runRequestedAt) return -1;
    if (!a.runRequestedAt && b.runRequestedAt) return 1;
    if (a.runRequestedAt && b.runRequestedAt) {
      return a.runRequestedAt.getTime() - b.runRequestedAt.getTime();
    }
    if (a.nextCheckAt === null && b.nextCheckAt === null) return 0;
    if (a.nextCheckAt === null) return -1;
    if (b.nextCheckAt === null) return 1;
    return a.nextCheckAt.getTime() - b.nextCheckAt.getTime();
  });
}
