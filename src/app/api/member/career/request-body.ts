import "server-only";

const decimalInteger = /^\d+$/u;

export const careerRequestBodyLimits = {
  documentReviewBytes: 2_000,
  documentUploadBytes: 5_500_000,
  documentVersionBytes: 700_000,
  jobSaveBytes: 250_000,
  jobSearchBytes: 25_000,
} as const;

export class CareerRequestBodyError extends Error {
  constructor(readonly reason: "invalid" | "too_large") {
    super(`career_request_body_${reason}`);
    this.name = "CareerRequestBodyError";
  }
}

function validateMaximumBytes(maximumBytes: number): void {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError("maximumBytes must be a positive safe integer");
  }
}

function declaredBodyIsTooLarge(request: Request, maximumBytes: number): boolean {
  const value = request.headers.get("content-length")?.trim();
  if (!value || !decimalInteger.test(value)) return false;
  try {
    return BigInt(value) > BigInt(maximumBytes);
  } catch {
    return true;
  }
}

/**
 * Reads a request body incrementally and stops before retaining more than the
 * declared ceiling. Content-Length is only an early rejection hint: the stream
 * itself is always counted so chunked and incorrectly declared bodies cannot
 * bypass the limit.
 */
export async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  validateMaximumBytes(maximumBytes);
  if (declaredBodyIsTooLarge(request, maximumBytes)) {
    throw new CareerRequestBodyError("too_large");
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new CareerRequestBodyError("invalid");
      if (value.byteLength > maximumBytes - totalBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size failure remains authoritative if stream cancellation fails.
        }
        throw new CareerRequestBodyError("too_large");
      }
      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedJsonBody(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  const bytes = await readBoundedRequestBody(request, maximumBytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof CareerRequestBodyError) throw error;
    throw new CareerRequestBodyError("invalid");
  }
}

export async function readBoundedFormDataBody(
  request: Request,
  maximumBytes: number,
): Promise<FormData> {
  const bytes = await readBoundedRequestBody(request, maximumBytes);
  const contentType = request.headers.get("content-type");
  if (!contentType) throw new CareerRequestBodyError("invalid");
  try {
    return await new Request(request.url, {
      body: Buffer.from(bytes),
      headers: { "content-type": contentType },
      method: "POST",
    }).formData();
  } catch (error) {
    if (error instanceof CareerRequestBodyError) throw error;
    throw new CareerRequestBodyError("invalid");
  }
}
