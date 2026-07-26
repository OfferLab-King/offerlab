"use server";
import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  administerServiceOffering,
  administerServiceRequest,
} from "../../../modules/practice-services/application/services";
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
