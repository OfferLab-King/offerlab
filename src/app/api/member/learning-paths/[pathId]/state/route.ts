import { NextResponse } from "next/server";
import { currentMemberAccess } from "../../../../../../modules/identity-access/application/authorization";
import { hasSameOrigin as hasTrustedMutationOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { readOnboardingProfile } from "../../../../../../modules/member-profile/application/onboarding";
import { setPathFollowing } from "../../../../../../modules/learning-paths/application/learning-paths";
export const runtime = "nodejs";
export async function PUT(request: Request, { params }: { params: Promise<{ pathId: string }> }) {
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
    typeof (body as { follow?: unknown }).follow !== "boolean"
  )
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const pathId = (await params).pathId;
  if (!/^[0-9a-f-]{36}$/iu.test(pathId))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const outcome = await setPathFollowing(
    access.authorization.userId,
    pathId,
    (body as { follow: boolean }).follow,
  );
  return NextResponse.json(
    { outcome },
    {
      headers: { "cache-control": "private, no-store" },
      status: outcome === "not_found" ? 404 : 200,
    },
  );
}
