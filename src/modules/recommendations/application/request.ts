import { z } from "zod";

export const RECOMMENDATION_JSON_BODY_LIMIT_BYTES = 8_192;

const recommendationMutationSchema = z
  .object({
    expectedVersion: z.number().int().positive().nullable(),
    recommendationKey: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
    ruleVersion: z.number().int().positive(),
    targetState: z.enum(["pending", "completed", "dismissed"]),
  })
  .strict();

export type RecommendationMutationInput = Readonly<z.infer<typeof recommendationMutationSchema>>;

export type RecommendationJsonReadResult =
  Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; status: 400 | 413 | 415 }>;

export function parseRecommendationMutationInput(
  input: unknown,
): Readonly<{ ok: true; value: RecommendationMutationInput }> | Readonly<{ ok: false }> {
  const parsed = recommendationMutationSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

export async function readRecommendationJson(
  request: Request,
): Promise<RecommendationJsonReadResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > RECOMMENDATION_JSON_BODY_LIMIT_BYTES) {
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
    if (received > RECOMMENDATION_JSON_BODY_LIMIT_BYTES) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
