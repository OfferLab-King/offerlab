import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "../../../../../../infrastructure/logging/logger";
import { reviewCareerDocument } from "../../../../../../modules/career-documents/application/career-documents";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { careerApiOwner, genericCareerError } from "../../../career/access";
import {
  CareerRequestBodyError,
  careerRequestBodyLimits,
  readBoundedJsonBody,
} from "../../../career/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    modelConsent: z.boolean(),
    providerNoticeVersion: z.string().min(1).max(128).nullable(),
    versionId: z.string().uuid(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericCareerError, { status: 403 });
  const access = await careerApiOwner();
  if ("response" in access) return access.response;
  try {
    const body = requestSchema.safeParse(
      await readBoundedJsonBody(request, careerRequestBodyLimits.documentReviewBytes),
    );
    if (!body.success) return NextResponse.json(genericCareerError, { status: 422 });
    const { documentId } = await context.params;
    const result = await reviewCareerDocument(access.ownerId, documentId, body.data.versionId, {
      modelConsent: body.data.modelConsent,
      providerNoticeVersion: body.data.providerNoticeVersion,
    });
    if (!result) return NextResponse.json(genericCareerError, { status: 404 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CareerRequestBodyError) {
      return NextResponse.json(genericCareerError, {
        status: error.reason === "too_large" ? 413 : 422,
      });
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "career_document_target_required") {
      return NextResponse.json(
        {
          message:
            "Save a version with a company, role and job description before requesting review.",
        },
        { status: 422 },
      );
    }
    if (code === "career_document_review_consent_required") {
      return NextResponse.json(
        { message: "Accept the current provider data notice before requesting AI review." },
        { status: 422 },
      );
    }
    if (code === "career_document_review_limit_reached") {
      return NextResponse.json(
        { message: "You have reached the current document-review limit. Try again later." },
        { status: 429 },
      );
    }
    if (code === "career_document_review_disabled") {
      return NextResponse.json(
        { message: "Document review is temporarily unavailable. Your saved versions are safe." },
        { status: 503 },
      );
    }
    logger.error({ err: error, event: "career_document_review_failed" }, "Career document review failed");
    return NextResponse.json(genericCareerError, { status: 500 });
  }
}
