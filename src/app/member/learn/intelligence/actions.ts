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
    formatSummary: formData.get("formatSummary"),
    industry: formData.get("industry") || null,
    opportunityType: formData.get("opportunityType") || null,
    recruitmentCycle: formData.get("recruitmentCycle"),
    recruitmentStage: formData.get("recruitmentStage"),
    reflection: formData.get("reflection"),
    themes: formData.get("themes"),
  });
  redirect(`/member/learn/intelligence?result=${result.ok ? "submitted" : "invalid"}`);
}
