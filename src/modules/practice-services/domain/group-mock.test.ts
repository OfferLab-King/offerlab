import { describe, expect, it } from "vitest";

import {
  formatLondonDateTimeInput,
  groupMockBookingSchema,
  groupMockMaterialSchema,
  groupMockSessionSchema,
  parseLondonDateTime,
} from "./group-mock";
import { createGroupMockMaterial } from "../application/group-mock";

const material = {
  debriefQuestions: ["What helped the group decide?", "What would you change next time?"],
  deliverable: "Agree a recommendation and present the supporting trade-offs.",
  difficulty: "standard",
  discussionMinutes: 40,
  exerciseType: "prioritisation",
  followUpMinutes: 10,
  informationPack: "Three fictional projects have different costs, risks and likely outcomes.",
  observerRubric: "Notice evidence-led contributions, inclusive discussion and time awareness.",
  originalityConfirmed: true,
  participantInstructions: "Read the pack individually, then reach a shared group recommendation.",
  preparationMinutes: 10,
  problemType: "capital_allocation",
  publicationState: "published",
  recommendedGroupSize: 5,
  recommendedMinutes: 60,
  scenario: "A fictional charity must decide which community project to fund this year.",
  sector: "retail_consumer",
  skills: ["collaboration", "prioritisation"],
  stableKey: "community_priority",
  summary: "Practise prioritising competing projects as a group.",
  title: "Community project prioritisation",
} as const;

const session = {
  accessMode: "member_included",
  capacity: 6,
  endsAt: new Date("2026-08-10T19:00:00.000Z"),
  materialId: "40000000-0000-4000-8000-000000000001",
  meetingInstructions: null,
  meetingProvider: null,
  meetingUrl: null,
  minimumParticipants: 3,
  paymentUrl: null,
  pricePence: null,
  startsAt: new Date("2026-08-10T18:00:00.000Z"),
  state: "open",
  title: "Monday group mock",
} as const;

describe("Group Mock validation", () => {
  it("requires administrators to confirm material originality", () => {
    expect(groupMockMaterialSchema.safeParse(material).success).toBe(true);
    expect(
      groupMockMaterialSchema.safeParse({ ...material, originalityConfirmed: false }).success,
    ).toBe(false);
  });

  it("returns safe field names when administrator material is invalid", async () => {
    await expect(
      createGroupMockMaterial("40000000-0000-4000-8000-000000000001", {
        ...material,
        debriefQuestions: ["Only one question"],
        scenario: "Too short",
      }),
    ).resolves.toEqual({
      fields: expect.arrayContaining(["debriefQuestions", "scenario"]),
      outcome: "invalid",
    });
  });

  it("keeps paid access and meeting links explicit and credential-free", () => {
    expect(groupMockSessionSchema.safeParse(session).success).toBe(true);
    expect(
      groupMockSessionSchema.safeParse({
        ...session,
        accessMode: "manual_payment",
        paymentUrl: null,
        pricePence: 1500,
      }).success,
    ).toBe(false);
    expect(
      groupMockSessionSchema.safeParse({
        ...session,
        meetingProvider: "zoom",
        meetingUrl: "https://user:secret@example.com/join",
      }).success,
    ).toBe(false);
  });

  it("requires both adult eligibility and participation rules acceptance", () => {
    const valid = {
      ageConfirmed: true,
      rulesConfirmed: true,
      sessionId: "40000000-0000-4000-8000-000000000001",
    };
    expect(groupMockBookingSchema.safeParse(valid).success).toBe(true);
    expect(groupMockBookingSchema.safeParse({ ...valid, ageConfirmed: false }).success).toBe(false);
  });

  it("converts unambiguous London wall times and rejects a skipped DST time", () => {
    expect(parseLondonDateTime("2026-07-27T10:00")?.toISOString()).toBe("2026-07-27T09:00:00.000Z");
    expect(parseLondonDateTime("2026-01-27T10:00")?.toISOString()).toBe("2026-01-27T10:00:00.000Z");
    expect(parseLondonDateTime("2026-03-29T01:30")).toBeNull();
    expect(formatLondonDateTimeInput("2026-07-27T09:00:00.000Z")).toBe("2026-07-27T10:00");
  });
});
