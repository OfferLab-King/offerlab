import { checkPublicInternetUrl, type HostResolver } from "../../domain/network";
import { isSafeWebUrl } from "../../domain/urls";
import { logger } from "../logging";
import { JobFetchError } from "./errors";

export type HttpResponse = Readonly<{
  body: string;
  headers: Headers;
  status: number;
  url: string;
}>;

export type HttpClientOptions = Readonly<{
  timeoutMs: number;
  userAgent: string;
  retries?: number;
  maxResponseBytes?: number;
  resolveHost?: HostResolver;
}>;

function backoffDelay(attempt: number): number {
  const base = 400 * 2 ** Math.min(attempt, 4);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

export const DEFAULT_MAX_RESPONSE_BYTES = 5_000_000;
const MAX_REDIRECTS = 5;

export type HttpClient = Readonly<{
  retries: number;
  timeoutMs: number;
  userAgent: string;
  maxResponseBytes: number;
  resolveHost?: HostResolver;
  assertSafeUrl: (value: string) => Promise<void>;
}>;

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const resolveHost = options.resolveHost;
  return {
    retries: options.retries ?? 2,
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
    maxResponseBytes,
    ...(resolveHost ? { resolveHost } : {}),
    assertSafeUrl: async (value: string) => {
      const decision = await checkPublicInternetUrl(value, {
        ...(resolveHost ? { resolve: resolveHost } : {}),
      });
      if (decision.outcome !== "safe") {
        throw new JobFetchError(
          "not_configured",
          `blocked_network_destination_${decision.outcome}`,
        );
      }
    },
  };
}

async function boundedResponseText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new JobFetchError("source_unavailable", "response_too_large");
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new JobFetchError("source_unavailable", "response_too_large");
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  return body + decoder.decode();
}

export async function fetchText(
  url: string,
  options: Readonly<{
    headers?: Readonly<Record<string, string>>;
    httpClient: HttpClient;
    retryable?: boolean;
    method?: "GET" | "POST";
    body?: string;
  }>,
): Promise<HttpResponse> {
  if (!isSafeWebUrl(url)) {
    throw new JobFetchError("not_configured", "invalid_http_url");
  }
  const retryable = options.retryable ?? true;
  const attempts = options.httpClient.retries + 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.httpClient.timeoutMs);
    try {
      const request: { body?: string; method: "GET" | "POST" } = {
        method: options.method ?? "GET",
      };
      if (options.body !== undefined) request.body = options.body;
      const response = await fetchWithBoundedRedirects(
        url,
        options.httpClient,
        controller.signal,
        request,
      );
      if (response.status === 403) {
        logger.warn({
          event: "job_fetch_forbidden",
          statusCode: 403,
          url: hostOnly(url),
        });
        throw new JobFetchError("http_403", "http_403_forbidden", { statusCode: 403 });
      }
      if (response.status === 404) {
        throw new JobFetchError("http_404", "http_404_not_found", { statusCode: 404 });
      }
      if (response.status === 429) {
        throw new JobFetchError("http_429", "http_429_rate_limited", {
          retryable: true,
          statusCode: 429,
        });
      }
      if (!response.ok) {
        throw new JobFetchError(`http_error`, "http_error", {
          retryable: response.status >= 500,
          statusCode: response.status,
        });
      }
      const body = await boundedResponseText(response, options.httpClient.maxResponseBytes);
      clearTimeout(timeout);
      return { body, headers: response.headers, status: response.status, url: response.url };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      const shouldRetry = error instanceof JobFetchError ? error.retryable && retryable : retryable;
      if (shouldRetry && attempt < attempts - 1) {
        const delay = backoffDelay(attempt);
        logger.warn({
          attempt: attempt + 1,
          delayMs: delay,
          event: "job_fetch_retry",
          source: hostOnly(url),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (error instanceof JobFetchError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new JobFetchError("network_timeout", "network_timeout", { retryable: true });
      }
      throw new JobFetchError("network_error", "network_error", { retryable: true });
    }
  }
  throw lastError ?? new JobFetchError("source_unavailable", "source_unavailable");
}

async function fetchWithBoundedRedirects(
  initialUrl: string,
  httpClient: HttpClient,
  signal: AbortSignal,
  request: Readonly<{ body?: string; method: "GET" | "POST" }>,
): Promise<Response> {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await httpClient.assertSafeUrl(currentUrl);
    const init: RequestInit = {
      headers: {
        accept: "*/*",
        "user-agent": httpClient.userAgent,
      },
      method: request.method,
      redirect: "manual",
      signal,
    };
    if (request.body !== undefined) init.body = request.body;
    const response = await fetch(currentUrl, init);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const next = new URL(location, currentUrl);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new JobFetchError("not_configured", "unsafe_redirect_protocol");
      }
      currentUrl = next.toString();
      continue;
    }
    return response;
  }
  throw new JobFetchError("source_unavailable", "too_many_redirects");
}

function hostOnly(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown-host";
  }
}
