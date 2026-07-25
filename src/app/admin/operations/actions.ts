"use server";
import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  administerServiceOffering,
  administerServiceRequest,
} from "../../../modules/practice-services/application/services";
import { reviewIntelligenceReport } from "../../../modules/recruitment-intelligence/application/reports";

export async function moderateReportAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const state = formData.get("state");
  const confidence = formData.get("confidence");
  if (
    (state !== "published" && state !== "rejected") ||
    (confidence !== "low" && confidence !== "medium" && confidence !== "high")
  )
    redirect("/admin/operations?result=error");
  const result = await reviewIntelligenceReport(
    administrator.userId,
    String(formData.get("id")),
    Number(formData.get("version")),
    state,
    confidence,
  );
  redirect(
    `/admin/operations?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "saved" : "error"}`,
  );
}

export async function updateServiceRequestAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await administerServiceRequest(administrator.userId, {
    id: formData.get("id"),
    status: formData.get("status"),
    version: Number(formData.get("version")),
  });
  redirect(
    `/admin/operations?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "saved" : "error"}`,
  );
}

export async function updateServiceOfferingAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await administerServiceOffering(administrator.userId, {
    availability: formData.get("availability"),
    id: formData.get("id"),
    version: Number(formData.get("version")),
  });
  redirect(
    `/admin/operations?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "saved" : "error"}`,
  );
}
