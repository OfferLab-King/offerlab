import { NextResponse } from "next/server";

import { captureAnalyticsEvent } from "../../../../infrastructure/analytics/capture";
import { checkBeaconRateLimit } from "../../../../infrastructure/rate-limit/beacon-rate-limit";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";
import { isJobCatalogEnabled } from "../../../../modules/job-catalog/application/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Content-free apply-click beacon. Sends no job, employer or user data; the
 * event carries no properties. Used to measure how often users leave for the
 * official employer application.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isJobCatalogEnabled()) return NextResponse.json({}, { status: 404 });
  if (!hasSameOrigin(request)) return NextResponse.json({}, { status: 403 });
  if (!checkBeaconRateLimit(request)) return NextResponse.json({}, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as unknown;
  if (typeof body !== "object" || body === null) return NextResponse.json({}, { status: 422 });
  const eventName = (body as Readonly<Record<string, unknown>>).event;
  if (eventName !== "employer_apply_click" && eventName !== "job_view") {
    return NextResponse.json({}, { status: 422 });
  }
  await captureAnalyticsEvent(eventName);
  return new NextResponse(null, { status: 204 });
}
