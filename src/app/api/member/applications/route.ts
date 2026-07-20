import { NextResponse } from "next/server";

import { logger } from "../../../../infrastructure/logging/logger";
import {
  addApplication,
  readApplications,
} from "../../../../modules/applications/application/applications";
import { readApplicationJson } from "../../../../modules/applications/application/request";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";
import { applicationApiOwner, genericApplicationError } from "./access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const access = await applicationApiOwner();
  if ("response" in access) return access.response;
  const archived = new URL(request.url).searchParams.get("view") === "archived";
  const applications = await readApplications(access.ownerId, archived);
  return NextResponse.json({ applications });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericApplicationError, { status: 403 });
  const body = await readApplicationJson(request);
  if (!body.ok) return NextResponse.json(genericApplicationError, { status: body.status });
  const access = await applicationApiOwner();
  if ("response" in access) return access.response;
  try {
    const result = await addApplication(access.ownerId, body.value);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    return NextResponse.json(result, { status: 201 });
  } catch {
    logger.error({ event: "application_create_failed" }, "Application creation failed");
    return NextResponse.json(genericApplicationError, { status: 500 });
  }
}
