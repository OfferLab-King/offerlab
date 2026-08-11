import { NextResponse } from "next/server";
import { z } from "zod";

import { currentMemberAccess } from "../../../../modules/identity-access/application/authorization";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";
import { isJobCatalogEnabled } from "../../../../modules/job-catalog/application/config";
import {
  listSavedJobsForMember,
  saveJobForMember,
  unsaveJobForMember,
} from "../../../../modules/job-catalog/application/saved-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const genericError = {
  message: "We could not complete that request. Please try again.",
};

const notFound = () => NextResponse.json(genericError, { status: 404 });

const jobIdSchema = z.object({
  jobId: z.string().uuid(),
});

async function memberOwner(): Promise<
  Readonly<{ ownerId: string }> | Readonly<{ response: NextResponse }>
> {
  const access = await currentMemberAccess();
  if (access.status === "unauthenticated") {
    return { response: NextResponse.json(genericError, { status: 401 }) };
  }
  if (access.status !== "eligible") {
    return { response: NextResponse.json(genericError, { status: 403 }) };
  }
  return { ownerId: access.authorization.userId };
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isJobCatalogEnabled()) return notFound();
  if (!hasSameOrigin(request)) return NextResponse.json(genericError, { status: 403 });
  const access = await memberOwner();
  if ("response" in access) return access.response;
  const jobs = await listSavedJobsForMember(access.ownerId);
  return NextResponse.json({ items: jobs });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isJobCatalogEnabled()) return notFound();
  if (!hasSameOrigin(request)) return NextResponse.json(genericError, { status: 403 });
  const access = await memberOwner();
  if ("response" in access) return access.response;
  let jobId: string;
  try {
    const parsed = jobIdSchema.parse(await request.json().catch(() => ({})));
    jobId = parsed.jobId;
  } catch {
    return NextResponse.json(genericError, { status: 422 });
  }
  try {
    await saveJobForMember(access.ownerId, jobId);
  } catch {
    return NextResponse.json(genericError, { status: 422 });
  }
  return NextResponse.json({ saved: true }, { status: 201 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!isJobCatalogEnabled()) return notFound();
  if (!hasSameOrigin(request)) return NextResponse.json(genericError, { status: 403 });
  const access = await memberOwner();
  if ("response" in access) return access.response;
  let jobId: string;
  try {
    const parsed = jobIdSchema.parse(await request.json().catch(() => ({})));
    jobId = parsed.jobId;
  } catch {
    return NextResponse.json(genericError, { status: 422 });
  }
  await unsaveJobForMember(access.ownerId, jobId);
  return NextResponse.json({ saved: false });
}
