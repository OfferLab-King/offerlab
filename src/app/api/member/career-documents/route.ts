import { NextResponse } from "next/server";
import { logger } from "../../../../infrastructure/logging/logger";
import { addUploadedCareerDocument } from "../../../../modules/career-documents/application/career-documents";
import { extractCareerDocument } from "../../../../modules/career-documents/infrastructure/document-extractor";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";
import { careerApiOwner, genericCareerError } from "../career/access";
import {
  CareerRequestBodyError,
  careerRequestBodyLimits,
  readBoundedFormDataBody,
} from "../career/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadErrors: Record<string, string> = {
  career_document_extraction_failed:
    "We could not read that document. Upload an unlocked PDF or DOCX file.",
  career_document_file_invalid: "Choose a non-empty PDF or DOCX file.",
  career_document_file_too_large: "The file must be no larger than 5 MB.",
  career_document_file_type_invalid: "Upload a PDF or DOCX file whose type matches its extension.",
  career_document_docx_archive_invalid:
    "That DOCX file is unsafe or damaged. Re-save it as a standard DOCX and try again.",
  career_document_extraction_timeout:
    "That document took too long to read. Re-save it as a standard PDF or DOCX and try again.",
  career_document_no_extractable_text:
    "We could not find enough selectable text. Use an unlocked text-based document rather than a scan.",
  career_document_pdf_too_many_pages: "The PDF must contain no more than 10 pages.",
  career_document_text_too_large: "The extracted document is too long for this workspace.",
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericCareerError, { status: 403 });
  const access = await careerApiOwner();
  if ("response" in access) return access.response;
  try {
    const form = await readBoundedFormDataBody(
      request,
      careerRequestBodyLimits.documentUploadBytes,
    );
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: uploadErrors.career_document_file_invalid },
        { status: 422 },
      );
    }
    const extracted = await extractCareerDocument(file);
    const result = await addUploadedCareerDocument(
      access.ownerId,
      { kind: form.get("kind"), title: form.get("title") },
      extracted,
    );
    if (result.outcome === "invalid") {
      return NextResponse.json(
        { message: "Add a short, descriptive document name." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { documentId: result.document.id, warnings: result.warnings },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CareerRequestBodyError) {
      return NextResponse.json(
        {
          message:
            error.reason === "too_large"
              ? uploadErrors.career_document_file_too_large
              : uploadErrors.career_document_file_invalid,
        },
        { status: error.reason === "too_large" ? 413 : 422 },
      );
    }
    const code = error instanceof Error ? error.message : "";
    if (code in uploadErrors) {
      return NextResponse.json({ message: uploadErrors[code] }, { status: 422 });
    }
    logger.error(
      { err: error, event: "career_document_upload_failed" },
      "Career document upload failed",
    );
    return NextResponse.json(genericCareerError, { status: 500 });
  }
}
