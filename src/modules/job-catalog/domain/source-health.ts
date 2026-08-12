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
