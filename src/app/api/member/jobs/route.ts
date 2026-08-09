import { NextResponse } from "next/server";
import { addCareerJobTarget } from "../../../../modules/career-documents/application/career-documents";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";
import { careerApiOwner, genericCareerError } from "../career/access";
import {
  CareerRequestBodyError,
  careerRequestBodyLimits,
  readBoundedJsonBody,
} from "../career/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericCareerError, { status: 403 });
  const access = await careerApiOwner();
  if ("response" in access) return access.response;
  try {
    const result = await addCareerJobTarget(
      access.ownerId,
      await readBoundedJsonBody(request, careerRequestBodyLimits.jobSaveBytes),
    );
    if (result.outcome === "invalid") {
      return NextResponse.json(
        { message: "Check the job details and try again." },
        { status: 422 },
      );
    }
    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch (error) {
    if (error instanceof CareerRequestBodyError) {
      return NextResponse.json(genericCareerError, {
        status: error.reason === "too_large" ? 413 : 422,
      });
    }
    return NextResponse.json(genericCareerError, { status: 500 });
  }
}
