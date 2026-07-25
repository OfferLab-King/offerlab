"use server";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import {
  cancelServiceRequest,
  requestService,
} from "../../../../modules/practice-services/application/services";

export async function requestServiceAction(formData: FormData) {
  const { userId } = await requireMember();
  const result = await requestService(userId, { offeringId: formData.get("offeringId") });
  redirect(
    `/member/learn/practice?result=${result.outcome === "invalid" || result.outcome === "not_found" ? "error" : "requested"}`,
  );
}

export async function cancelServiceAction(formData: FormData) {
  const { userId } = await requireMember();
  const result = await cancelServiceRequest(
    userId,
    String(formData.get("requestId")),
    Number(formData.get("version")),
  );
  redirect(
    `/member/learn/practice?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "cancelled" : "error"}`,
  );
}
