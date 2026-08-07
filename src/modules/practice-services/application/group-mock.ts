import "server-only";

import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  groupMockBookingAdministrationSchema,
  groupMockBookingSchema,
  groupMockMaterialSchema,
  groupMockSessionSchema,
} from "../domain/group-mock";
import * as repository from "../infrastructure/group-mock-repository";

export const readGroupMockLobby = (owner: string) =>
  withApplicationUser(owner, (database) => repository.listLobbySessions(database, owner));

export const readGroupMockSession = (owner: string, sessionId: string) =>
  withApplicationUser(owner, (database) =>
    repository.readBookedSession(database, owner, sessionId),
  );

export const readGroupMockCaseLibrary = (owner: string) =>
  withApplicationUser(owner, (database) => repository.listPublishedMaterials(database));

export const readGroupMockCase = (owner: string, materialId: string) =>
  withApplicationUser(owner, (database) => repository.readPublishedMaterial(database, materialId));

export const readGroupMockMaterialAdmin = (administrator: string, materialId: string) =>
  withApplicationUser(administrator, (database) =>
    repository.readMaterialForAdmin(database, materialId),
  );

export async function reserveGroupMockSeat(owner: string, input: unknown) {
  const parsed = groupMockBookingSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  return withApplicationUser(owner, (database) =>
    repository.createBooking(database, owner, parsed.data.sessionId),
  );
}

export const cancelGroupMockSeat = (owner: string, bookingId: string, expectedVersion: number) =>
  withApplicationUser(owner, (database) =>
    repository.cancelBooking(database, owner, bookingId, expectedVersion),
  );

export const readGroupMockAdmin = (administrator: string) =>
  withApplicationUser(administrator, async (database) => ({
    materials: await repository.listMaterialsForAdmin(database),
    sessions: await repository.listSessionsForAdmin(database),
  }));

function materialInput(input: unknown) {
  const parsed = groupMockMaterialSchema.safeParse(input);
  if (!parsed.success)
    return {
      fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "form")))],
      success: false as const,
    };
  return {
    data: {
      debrief_questions: parsed.data.debriefQuestions,
      deliverable: parsed.data.deliverable,
      difficulty: parsed.data.difficulty,
      discussion_minutes: parsed.data.discussionMinutes,
      exercise_type: parsed.data.exerciseType,
      follow_up_minutes: parsed.data.followUpMinutes,
      information_pack: parsed.data.informationPack,
      observer_rubric: parsed.data.observerRubric,
      participant_instructions: parsed.data.participantInstructions,
      preparation_minutes: parsed.data.preparationMinutes,
      problem_type: parsed.data.problemType,
      publicationState: parsed.data.publicationState,
      recommended_group_size: parsed.data.recommendedGroupSize,
      recommended_minutes: parsed.data.recommendedMinutes,
      scenario: parsed.data.scenario,
      sector: parsed.data.sector,
      skills: parsed.data.skills,
      stable_key: parsed.data.stableKey,
      summary: parsed.data.summary,
      title: parsed.data.title,
    },
    success: true as const,
  };
}

export async function createGroupMockMaterial(administrator: string, input: unknown) {
  const parsed = materialInput(input);
  if (!parsed.success) return { fields: parsed.fields, outcome: "invalid" } as const;
  const id = await withApplicationUser(administrator, (database) =>
    repository.createMaterial(database, administrator, parsed.data),
  );
  return { id, outcome: "changed" } as const;
}

export async function updateGroupMockMaterial(
  administrator: string,
  id: string,
  expectedVersion: number,
  input: unknown,
) {
  const parsed = materialInput(input);
  if (!parsed.success) return { fields: parsed.fields, outcome: "invalid" } as const;
  return withApplicationUser(administrator, (database) =>
    repository.updateMaterial(database, administrator, id, expectedVersion, parsed.data),
  );
}

export async function createGroupMockSession(administrator: string, input: unknown) {
  const parsed = groupMockSessionSchema.safeParse(input);
  if (!parsed.success)
    return {
      fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "form")))],
      outcome: "invalid",
    } as const;
  return withApplicationUser(administrator, (database) =>
    repository.createSession(database, administrator, parsed.data),
  );
}

export async function updateGroupMockSession(
  administrator: string,
  id: string,
  expectedVersion: number,
  input: unknown,
) {
  const parsed = groupMockSessionSchema.safeParse(input);
  if (!parsed.success)
    return {
      fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "form")))],
      outcome: "invalid",
    } as const;
  return withApplicationUser(administrator, (database) =>
    repository.updateSession(database, administrator, id, expectedVersion, parsed.data),
  );
}

export async function administerGroupMockBooking(administrator: string, input: unknown) {
  const parsed = groupMockBookingAdministrationSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  return withApplicationUser(administrator, (database) =>
    repository.updateBookingForAdmin(
      database,
      administrator,
      parsed.data.bookingId,
      parsed.data.version,
      parsed.data.status,
    ),
  );
}
