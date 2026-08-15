export type SourceUrlHealthStatus = "unchecked" | "healthy" | "redirected" | "invalid";

export type SourceUrlHealth = Readonly<{
  status: SourceUrlHealthStatus;
  statusCode: number | null;
  finalUrl: string | null;
  checkedAt: Date | null;
  errorCode: string | null;
  invalidSince: Date | null;
}>;

export function sourceUrlHealthAfterCheck(
  previous: SourceUrlHealth,
  check: Readonly<{
    checkedAt: Date;
    errorCode?: string | null;
    finalUrl?: string | null;
    requestedUrl: string;
    statusCode?: number | null;
  }>,
): SourceUrlHealth {
  const statusCode = check.statusCode ?? null;
  const finalUrl = check.finalUrl ?? null;
  const succeeded = statusCode !== null && statusCode >= 200 && statusCode < 300;
  if (!succeeded) {
    return {
      checkedAt: check.checkedAt,
      errorCode: check.errorCode ?? (statusCode === null ? "network_error" : `http_${statusCode}`),
      finalUrl,
      invalidSince: previous.invalidSince ?? check.checkedAt,
      status: "invalid",
      statusCode,
    };
  }
  const redirected = finalUrl !== null && finalUrl !== check.requestedUrl;
  return {
    checkedAt: check.checkedAt,
    errorCode: null,
    finalUrl,
    invalidSince: null,
    status: redirected ? "redirected" : "healthy",
    statusCode,
  };
}

export type ZeroResultTracking = Readonly<{
  anomaly: boolean;
  consecutiveZeroResults: number;
  lastNonZeroResultAt: Date | null;
}>;

/**
 * Zero-result tracking for a successful crawl.
 *
 * A source returning zero jobs is NOT invalid: programme landing pages are
 * legitimately empty between intakes. We count consecutive zero-result
 * successful crawls and record the last time the source produced jobs. An
 * anomaly (requiring review, never automatic deactivation) is flagged when a
 * source that previously had active jobs suddenly returns an empty listing on
 * a successful crawl. Jobs are never closed by a zero-result crawl: the
 * disappearance logic only runs on successful, non-empty listings.
 */
export function zeroResultTrackingAfterSuccessfulCrawl(
  input: Readonly<{
    discoveredCount: number;
    hadActiveJobs: boolean;
    now: Date;
    previousConsecutiveZeroResults: number;
  }>,
): ZeroResultTracking {
  if (input.discoveredCount > 0) {
    return {
      anomaly: false,
      consecutiveZeroResults: 0,
      lastNonZeroResultAt: input.now,
    };
  }
  return {
    anomaly: input.hadActiveJobs,
    consecutiveZeroResults: input.previousConsecutiveZeroResults + 1,
    lastNonZeroResultAt: null,
  };
}
