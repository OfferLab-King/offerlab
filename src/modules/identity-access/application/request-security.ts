import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const AUTH_JSON_BODY_LIMIT_BYTES = 4_096;

export function requestClientAddress(headers: Headers): string {
  const deployed = process.env.APP_ENV === "production" || process.env.APP_ENV === "staging";
  const candidate = deployed
    ? headers.get("x-vercel-forwarded-for")
    : (headers.get("x-vercel-forwarded-for") ??
      headers.get("cf-connecting-ip") ??
      headers.get("x-forwarded-for") ??
      headers.get("x-real-ip"));
  const address = candidate?.split(",", 1)[0]?.trim();
  return address && isIP(address) ? address : "unknown";
}

export function hasSameOrigin(request: Request): boolean {
  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) return false;
  try {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : new URL(request.url).origin;
    const host = request.headers.get("host");
    return (
      new URL(suppliedOrigin).origin === configuredOrigin && host === new URL(configuredOrigin).host
    );
  } catch {
    return false;
  }
}

export type PublicJsonReadResult =
  Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; status: 400 | 413 | 415 }>;

export async function readPublicJson(request: Request): Promise<PublicJsonReadResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > AUTH_JSON_BODY_LIMIT_BYTES) {
    return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > AUTH_JSON_BODY_LIMIT_BYTES) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function opaqueTokenSubject(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
