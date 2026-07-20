import { NextResponse } from "next/server";

import { logger } from "../../../../../../infrastructure/logging/logger";
import { archiveApplication } from "../../../../../../modules/applications/application/applications";
import { readApplicationJson } from "../../../../../../modules/applications/application/request";
import { isApplicationId } from "../../../../../../modules/applications/domain/application";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { applicationApiOwner, genericApplicationError } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = Readonly<{ params: Promise<{ applicationId: string }> }>;
const notFound = () => NextResponse.json(genericApplicationError, { status: 404 });

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericApplicationError, { status: 403 });
  const body = await readApplicationJson(request);
  if (!body.ok) return NextResponse.json(genericApplicationError, { status: body.status });
  const access = await applicationApiOwner();
  if ("response" in access) return access.response;
  const { applicationId } = await context.params;
  if (!isApplicationId(applicationId)) return notFound();
  try {
    const result = await archiveApplication(access.ownerId, applicationId, body.value);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    if (result.outcome === "not_found") return notFound();
    if (result.outcome === "conflict")
      return NextResponse.json({ ok: true, outcome: "conflict" }, { status: 409 });
    return NextResponse.json(result);
  } catch {
    logger.error({ event: "application_archive_failed" }, "Application archive change failed");
    return NextResponse.json(genericApplicationError, { status: 500 });
  }
}
