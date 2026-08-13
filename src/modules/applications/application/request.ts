export const APPLICATION_JSON_BODY_LIMIT_BYTES = 32_768;

export type ApplicationJsonReadResult =
  Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false; status: 400 | 413 | 415 }>;

export function applicationFormRequestBody(
  form: FormData,
  version?: number,
): Record<string, unknown> {
  const optional = (name: string): string | null => String(form.get(name) ?? "") || null;
  return {
    appliedDate: optional("appliedDate"),
    applicationDeadline: optional("applicationDeadline"),
    company: String(form.get("company") ?? ""),
    companyId: optional("companyId"),
    industry: optional("industry"),
    location: optional("location"),
    nextStageDeadline: optional("nextStageDeadline"),
    notes: optional("notes"),
    opportunityType: String(form.get("opportunityType") ?? ""),
    role: String(form.get("role") ?? ""),
    stage: String(form.get("stage") ?? ""),
    ...(version === undefined ? {} : { version }),
  };
}

export async function readApplicationJson(request: Request): Promise<ApplicationJsonReadResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > APPLICATION_JSON_BODY_LIMIT_BYTES) {
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
    if (received > APPLICATION_JSON_BODY_LIMIT_BYTES) {
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
