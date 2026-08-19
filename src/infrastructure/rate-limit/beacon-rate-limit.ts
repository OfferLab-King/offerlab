const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Bucket = Readonly<{ count: number; resetAt: number }>;

const buckets = new Map<string, Bucket>();

function bucketKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "anonymous";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}

export function checkBeaconRateLimit(request: Request): boolean {
  const key = bucketKey(request);
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_REQUESTS) return false;
  buckets.set(key, { count: existing.count + 1, resetAt: existing.resetAt });
  return true;
}

export function resetBeaconRateLimitForTests(): void {
  buckets.clear();
}
