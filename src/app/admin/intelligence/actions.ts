"use server";

import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  createCoachCuratedReport,
  reviewIntelligenceReport,
  updateIntelligenceReport,
} from "../../../modules/recruitment-intelligence/application/reports";
import {
  dismissIntelligenceCommentFlag,
  reviewIntelligenceComment,
} from "../../../modules/recruitment-intelligence/application/community";

function input(formData: FormData) {
  return {
    approximateDate: formData.get("approximateDate"),
    assessedSkills: String(formData.get("assessedSkills") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    companyName: formData.get("companyName"),
    confidentialityConfirmed: formData.get("confidentialityConfirmed") === "yes",
    formatSummary: formData.get("formatSummary"),
    industry: formData.get("industry") || null,
    location: formData.get("location") || null,
    opportunityType: formData.get("opportunityType") || null,
    outcome: formData.get("outcome") || null,
    preparationAdvice: formData.get("preparationAdvice"),
    recruitmentCycle: formData.get("recruitmentCycle"),
    recruitmentStage: formData.get("recruitmentStage"),
    reflection: formData.get("reflection"),
    roleTitle: formData.get("roleTitle"),
    themes: formData.get("themes"),
  };
}

export async function createIntelligenceAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await createCoachCuratedReport(administrator.userId, input(formData));
  redirect(
    result.ok
      ? `/admin/intelligence/${result.item.id}?result=created`
      : "/admin/intelligence/new?result=invalid",
  );
}

export async function updateIntelligenceAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const id = String(formData.get("id"));
  const result = await updateIntelligenceReport(
    administrator.userId,
    id,
    Number(formData.get("version")),
    input(formData),
  );
  redirect(
    "outcome" in result && result.outcome === "changed"
      ? `/admin/intelligence/${id}?result=saved`
      : `/admin/intelligence/${id}?result=error`,
  );
}

export async function moderateIntelligenceAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const state = formData.get("state");
  const confidence = formData.get("confidence");
  if (
    (state !== "published" && state !== "rejected") ||
    (confidence !== "low" && confidence !== "medium" && confidence !== "high")
  )
    redirect("/admin/intelligence?result=error");
  const result = await reviewIntelligenceReport(
    administrator.userId,
    String(formData.get("id")),
    Number(formData.get("version")),
    state,
    confidence,
  );
  redirect(
    `/admin/intelligence?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "saved" : "error"}`,
  );
}

export async function moderateIntelligenceCommentAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const state = formData.get("state");
  if (state !== "published" && state !== "rejected" && state !== "removed")
    redirect("/admin/intelligence?result=comment-error#discussion-moderation");
  const result = await reviewIntelligenceComment(
    administrator.userId,
    String(formData.get("id")),
    Number(formData.get("version")),
    state,
  );
  redirect(
    `/admin/intelligence?result=${result.outcome === "changed" ? "comment-saved" : "comment-error"}#discussion-moderation`,
  );
}

export async function dismissIntelligenceCommentFlagAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await dismissIntelligenceCommentFlag(
    administrator.userId,
    String(formData.get("flagId")),
  );
  redirect(
    `/admin/intelligence?result=${result.outcome === "changed" ? "comment-saved" : "comment-error"}#discussion-moderation`,
  );
}
