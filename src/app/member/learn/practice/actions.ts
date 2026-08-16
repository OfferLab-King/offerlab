"use server";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import {
  cancelServiceRequest,
  requestService,
} from "../../../../modules/practice-services/application/services";
import {
  cancelGroupMockSeat,
  reserveGroupMockSeat,
} from "../../../../modules/practice-services/application/group-mock";

async function requireOnboardedMember() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  return authorization;
}

export async function reserveGroupMockAction(formData: FormData) {
  const { userId } = await requireOnboardedMember();
  const result = await reserveGroupMockSeat(userId, {
    ageConfirmed: formData.get("ageConfirmed") === "yes",
    rulesConfirmed: formData.get("rulesConfirmed") === "yes",
    sessionId: formData.get("sessionId"),
  });
  const status = "status" in result ? result.status : null;
  redirect(
    `/member/learn/practice?result=${result.outcome === "invalid" || result.outcome === "not_found" ? "error" : status === "waitlisted" ? "waitlisted" : status === "payment_pending" ? "payment-pending" : "reserved"}`,
  );
}

export async function cancelGroupMockAction(formData: FormData) {
  const { userId } = await requireOnboardedMember();
  const result = await cancelGroupMockSeat(
    userId,
    String(formData.get("bookingId")),
    Number(formData.get("version")),
  );
  redirect(
    `/member/learn/practice?result=${result.outcome === "changed" ? "seat-cancelled" : "error"}`,
  );
}

export async function requestServiceAction(formData: FormData) {
  const { userId } = await requireOnboardedMember();
  const result = await requestService(userId, { offeringId: formData.get("offeringId") });
  redirect(
    `/member/learn/practice?result=${result.outcome === "invalid" || result.outcome === "not_found" ? "error" : "requested"}`,
  );
}

export async function cancelServiceAction(formData: FormData) {
  const { userId } = await requireOnboardedMember();
  const result = await cancelServiceRequest(
    userId,
    String(formData.get("requestId")),
    Number(formData.get("version")),
  );
  redirect(
    `/member/learn/practice?result=${result.outcome === "changed" || result.outcome === "unchanged" ? "cancelled" : "error"}`,
  );
}
