"use server";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { submitIntelligenceReport } from "../../../../modules/recruitment-intelligence/application/reports";

export async function submitReportAction(formData: FormData) {
  const { userId } = await requireMember();
  const result = await submitIntelligenceReport(userId, {
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
  });
  redirect(
    result.ok
      ? "/member/learn/intelligence?result=submitted"
      : "/member/learn/intelligence/share?result=invalid",
  );
}
