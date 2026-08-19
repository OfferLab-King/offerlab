"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  administerGroupMockBooking,
  createGroupMockMaterial,
  createGroupMockSession,
  updateGroupMockMaterial,
  updateGroupMockSession,
} from "../../../modules/practice-services/application/group-mock";
import { parseLondonDateTime } from "../../../modules/practice-services/domain/group-mock";

function materialInput(formData: FormData) {
  const preparationMinutes = Number(formData.get("preparationMinutes"));
  const discussionMinutes = Number(formData.get("discussionMinutes"));
  const followUpMinutes = Number(formData.get("followUpMinutes"));
  return {
    debriefQuestions: String(formData.get("debriefQuestions") ?? "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
    deliverable: formData.get("deliverable"),
    difficulty: formData.get("difficulty"),
    discussionMinutes,
    exerciseType: formData.get("exerciseType"),
    followUpMinutes,
    informationPack: formData.get("informationPack"),
    observerRubric: formData.get("observerRubric"),
    originalityConfirmed: formData.get("originalityConfirmed") === "yes",
    participantInstructions: formData.get("participantInstructions"),
    preparationMinutes,
    problemType: formData.get("problemType"),
    publicationState: formData.get("publicationState"),
    recommendedGroupSize: Number(formData.get("recommendedGroupSize")),
    recommendedMinutes: preparationMinutes + discussionMinutes + followUpMinutes,
    scenario: formData.get("scenario"),
    sector: formData.get("sector"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((value) =>
        value
          .trim()
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "_"),
      )
      .filter(Boolean),
    stableKey: formData.get("stableKey"),
    summary: formData.get("summary"),
    title: formData.get("title"),
  };
}

function sessionInput(formData: FormData) {
  const accessMode = formData.get("accessMode");
  const meetingUrl = String(formData.get("meetingUrl") ?? "").trim();
  const paymentUrl = String(formData.get("paymentUrl") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  return {
    accessMode,
    capacity: Number(formData.get("capacity")),
    endsAt: parseLondonDateTime(formData.get("endsAt")),
    materialId: formData.get("materialId"),
    meetingInstructions: String(formData.get("meetingInstructions") ?? "").trim() || null,
    meetingProvider: meetingUrl ? formData.get("meetingProvider") : null,
    meetingUrl: meetingUrl || null,
    minimumParticipants: Number(formData.get("minimumParticipants")),
    paymentUrl: accessMode === "manual_payment" ? paymentUrl || null : null,
    pricePence:
      accessMode === "manual_payment" && price ? Math.round(Number.parseFloat(price) * 100) : null,
    startsAt: parseLondonDateTime(formData.get("startsAt")),
    state: formData.get("state"),
    title: formData.get("title"),
  };
}

const destination = (result: string, anchor: string, fields?: readonly string[]) =>
  `/admin/group-mock?result=${result}${fields?.length ? `&fields=${encodeURIComponent(fields.join(","))}` : ""}#${anchor}` as Route;

export async function createGroupMockMaterialAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await createGroupMockMaterial(administrator.userId, materialInput(formData));
  if (result.outcome === "changed")
    redirect(`/admin/group-mock/materials/${result.id}?result=material-saved` as Route);
  redirect(
    `/admin/group-mock/materials/new?result=invalid-material&fields=${encodeURIComponent(result.fields.join(","))}` as Route,
  );
}

export async function updateGroupMockMaterialAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await updateGroupMockMaterial(
    administrator.userId,
    String(formData.get("id")),
    Number(formData.get("version")),
    materialInput(formData),
  );
  const id = String(formData.get("id"));
  redirect(
    `/admin/group-mock/materials/${id}?result=${result.outcome === "changed" ? "material-saved" : "invalid-material"}${"fields" in result ? `&fields=${encodeURIComponent(result.fields.join(","))}` : ""}` as Route,
  );
}

export async function createGroupMockSessionAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await createGroupMockSession(administrator.userId, sessionInput(formData));
  redirect(
    destination(
      result.outcome === "changed" ? "session-saved" : "invalid-session",
      "sessions",
      "fields" in result ? result.fields : undefined,
    ),
  );
}

export async function updateGroupMockSessionAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await updateGroupMockSession(
    administrator.userId,
    String(formData.get("id")),
    Number(formData.get("version")),
    sessionInput(formData),
  );
  redirect(
    destination(
      result.outcome === "changed" ? "session-saved" : "invalid-session",
      "sessions",
      "fields" in result ? result.fields : undefined,
    ),
  );
}

export async function updateGroupMockBookingAction(formData: FormData) {
  const administrator = await requireAdministrator();
  const result = await administerGroupMockBooking(administrator.userId, {
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
    version: Number(formData.get("version")),
  });
  redirect(
    destination(
      result.outcome === "changed"
        ? "booking-saved"
        : result.outcome === "capacity_or_conflict"
          ? "booking-capacity"
          : "error",
      "sessions",
    ),
  );
}
