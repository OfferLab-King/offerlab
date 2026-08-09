import { NextResponse } from "next/server";
import { logger } from "../../../../../../infrastructure/logging/logger";
import { addCareerDocumentVersion } from "../../../../../../modules/career-documents/application/career-documents";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { careerApiOwner, genericCareerError } from "../../../career/access";
import {
  CareerRequestBodyError,
  careerRequestBodyLimits,
  readBoundedJsonBody,
} from "../../../career/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericCareerError, { status: 403 });
  const access = await careerApiOwner();
  if ("response" in access) return access.response;
  try {
    const { documentId } = await context.params;
    const result = await addCareerDocumentVersion(
      access.ownerId,
      documentId,
      await readBoundedJsonBody(request, careerRequestBodyLimits.documentVersionBytes),
    );
    if (result.outcome === "invalid") {
      return NextResponse.json(
        { fields: result.fields, message: "Check the highlighted fields." },
        { status: 422 },
      );
    }
    if (result.outcome === "not_found")
      return NextResponse.json(genericCareerError, { status: 404 });
    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch (error) {
    if (error instanceof CareerRequestBodyError) {
      return NextResponse.json(genericCareerError, {
        status: error.reason === "too_large" ? 413 : 422,
      });
    }
    logger.error(
      { event: "career_document_version_create_failed" },
      "Career document version creation failed",
    );
    return NextResponse.json(genericCareerError, { status: 500 });
  }
}
