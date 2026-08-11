export type JobFetchErrorCode =
  | "network_timeout"
  | "network_error"
  | "http_403"
  | "http_404"
  | "http_429"
  | "http_error"
  | "robots_blocked"
  | "parser_changed"
  | "source_unavailable"
  | "not_configured"
  | "unsupported";

export class JobFetchError extends Error {
  readonly code: JobFetchErrorCode;
  readonly retryable: boolean;
  readonly statusCode: number | undefined;

  constructor(
    code: JobFetchErrorCode,
    message: string,
    options: Readonly<{ retryable?: boolean; statusCode?: number }> = {},
  ) {
    super(message);
    this.name = "JobFetchError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
  }
}
