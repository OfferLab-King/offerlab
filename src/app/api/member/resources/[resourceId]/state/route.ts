import { NextResponse } from "next/server";
import { currentMemberAccess } from "../../../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../../../modules/member-profile/application/onboarding";
import { changeResourceState } from "../../../../../../modules/preparation-resources/application/resources";
import { hasSameOrigin as hasTrustedMutationOrigin } from "../../../../../../modules/identity-access/application/request-security";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  if (!hasTrustedMutationOrigin(request))
    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  const access = await currentMemberAccess();
  if (access.status !== "eligible")
    return NextResponse.json(
      { error: "Access denied." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  if (!(await readOnboardingProfile(access.authorization.userId))?.completedAt)
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 1024) throw new Error();
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body).length !== 1 ||
    !["save", "unsave", "complete", "incomplete"].includes(
      (body as { action?: string }).action ?? "",
    )
  )
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const id = (await params).resourceId;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const result = await changeResourceState(
    access.authorization.userId,
    id,
    (body as { action: "save" | "unsave" | "complete" | "incomplete" }).action,
  );
  return NextResponse.json(result, {
    status: result.outcome === "not_found" ? 404 : 200,
    headers: { "cache-control": "private, no-store" },
  });
}
