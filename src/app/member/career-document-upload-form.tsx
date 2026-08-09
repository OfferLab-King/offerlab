"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { CareerDocumentKind } from "../../modules/career-documents/domain/career-document";

export function CareerDocumentUploadForm({ kind }: { kind: CareerDocumentKind }) {
  const router = useRouter();
  const fileId = useId();
  const titleId = useId();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const label = kind === "cv" ? "CV" : "cover letter";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("kind", kind);
    try {
      const response = await fetch("/api/member/career-documents", {
        body: form,
        method: "POST",
      });
      const result = (await response.json()) as {
        documentId?: string;
        message?: string;
        warnings?: readonly string[];
      };
      if (!response.ok || !result.documentId) {
        setError(result.message ?? `We could not upload that ${label}.`);
        return;
      }
      const destination =
        kind === "cv"
          ? `/member/cvs/${result.documentId}`
          : `/member/cover-letters/${result.documentId}`;
      const warning = result.warnings?.length ? "?uploadWarning=features-omitted" : "";
      router.push(`${destination}${warning}` as Route);
      router.refresh();
    } catch {
      setError(`We could not upload that ${label}. Try again.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="upload-card"
      encType="multipart/form-data"
      onSubmit={(event) => void submit(event)}
    >
      {error && (
        <p className="error-summary" role="alert">
          {error}
        </p>
      )}
      <div className="career-upload-fields">
        <label htmlFor={titleId}>
          Document name
          <input
            id={titleId}
            maxLength={160}
            name="title"
            placeholder={kind === "cv" ? "Base CV" : "General cover letter"}
            required
          />
        </label>
        <label htmlFor={fileId}>
          {kind === "cv" ? "CV file" : "Cover-letter file"}
          <input
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            id={fileId}
            name="file"
            required
            type="file"
          />
        </label>
      </div>
      <p className="hint">
        PDF or DOCX, up to 5 MB. OfferLab extracts editable text and discards the uploaded binary;
        formatting review is therefore limited to the extracted reading order.
      </p>
      <button disabled={pending} type="submit">
        {pending ? "Checking and extracting…" : `Upload ${label}`}
      </button>
      <p aria-live="polite" className="visually-hidden">
        {pending ? "Uploading, checking the file and extracting text." : ""}
      </p>
    </form>
  );
}
