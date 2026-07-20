import { createHmac } from "node:crypto";

import type { Sql } from "postgres";

import { withIdentitySyncRole } from "./identity-sync-database";

export type AuthRateLimitAction =
  "identity_link" | "recovery" | "registration" | "verification_resend";

export type RateLimitDecision = Readonly<{ allowed: boolean; retryAfterSeconds: number }>;

function fingerprint(value: string): string {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret)
    throw new Error("AUTH_RATE_LIMIT_SECRET is required for authentication rate limiting.");
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export async function checkAuthRateLimit(
  database: Sql,
  action: AuthRateLimitAction,
  subjects: readonly string[],
): Promise<RateLimitDecision> {
  let retryAfterSeconds = 1;
  for (const subject of subjects) {
    const rows = await withIdentitySyncRole(
      database,
      (transaction) =>
        transaction<{ allowed: boolean; retry_after_seconds: number }[]>`
        select * from app.check_auth_rate_limit(${action}, ${fingerprint(`${action}:${subject}`)})
      `,
    );
    const decision = rows[0];
    if (!decision) throw new Error("Rate limiter did not return a decision.");
    retryAfterSeconds = Math.max(retryAfterSeconds, decision.retry_after_seconds);
    if (!decision.allowed) return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds };
}

export async function cleanupExpiredAuthRateLimits(database: Sql): Promise<number> {
  const rows = await withIdentitySyncRole(
    database,
    (transaction) =>
      transaction<{ deleted: number }[]>`
        select app.cleanup_expired_auth_rate_limits() as deleted
      `,
  );
  const deleted = rows[0]?.deleted;
  if (deleted === undefined) throw new Error("Rate-limit cleanup did not return a result.");
  return deleted;
}
