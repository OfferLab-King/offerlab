"use server";

import { redirect } from "next/navigation";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import {
  reportIntelligenceComment,
  submitIntelligenceComment,
} from "../../../../../modules/recruitment-intelligence/application/community";

const safeSlug = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^[a-z0-9-]{1,180}$/u.test(value) ? value : null;

export async function submitCommentAction(formData: FormData) {
  const { userId } = await requireMember();
  const slug = safeSlug(formData.get("slug"));
  if (!slug) redirect("/member/learn/intelligence");
  const result = await submitIntelligenceComment(userId, {
    agreementConfirmed: formData.get("agreementConfirmed") === "yes",
    body: formData.get("body"),
    parentCommentId: formData.get("parentCommentId") || null,
    reportId: formData.get("reportId"),
  });
  const outcome = "outcome" in result ? result.outcome : "invalid";
  redirect(`/member/learn/intelligence/${slug}?discussion=${outcome}#discussion`);
}

export async function flagCommentAction(formData: FormData) {
  const { userId } = await requireMember();
  const slug = safeSlug(formData.get("slug"));
  if (!slug) redirect("/member/learn/intelligence");
  const result = await reportIntelligenceComment(
    userId,
    String(formData.get("commentId")),
    formData.get("reason"),
  );
  redirect(
    `/member/learn/intelligence/${slug}?discussion=${"outcome" in result ? "flagged" : "invalid"}#discussion`,
  );
}
