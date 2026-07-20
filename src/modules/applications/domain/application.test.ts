import { describe, expect, it } from "vitest";

import { parseApplicationInput } from "./application";

const valid = {
  appliedDate: null,
  applicationDeadline: "2026-09-30",
  company: "Example Plc",
  industry: "consulting",
  location: "London",
  nextStageDeadline: null,
  notes: "Prepare examples",
  opportunityType: "graduate_scheme",
  role: "Graduate Analyst",
  stage: "preparing",
};

describe("application input", () => {
  it.each([
    ["blank company", { company: " \t " }, "company"],
    ["blank role", { role: " \n " }, "role"],
    ["unsupported opportunity", { opportunityType: "contract" }, "opportunityType"],
    ["unsupported industry", { industry: "space" }, "industry"],
    ["unsupported stage", { stage: "telephone_interview" }, "stage"],
    ["overlong company", { company: "x".repeat(121) }, "company"],
    ["overlong role", { role: "x".repeat(161) }, "role"],
    ["overlong location", { location: "x".repeat(121) }, "location"],
    ["overlong notes", { notes: "x".repeat(2001) }, "notes"],
    [
      "malformed application deadline",
      { applicationDeadline: "2026-02-30" },
      "applicationDeadline",
    ],
    ["malformed applied date", { appliedDate: "20 July 2026" }, "appliedDate"],
    ["malformed next-stage deadline", { nextStageDeadline: "2026-13-01" }, "nextStageDeadline"],
  ])("rejects %s", (_name, replacement, field) => {
    const result = parseApplicationInput({ ...valid, ...replacement });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid input.");
    expect(result.errors).toHaveProperty(field);
  });

  it("rejects unexpected fields and a missing update version", () => {
    expect(parseApplicationInput({ ...valid, ownerId: "attacker" }).ok).toBe(false);
    const update = parseApplicationInput(valid, true);
    expect(update).toMatchObject({ errors: { version: expect.any(Array) }, ok: false });
  });

  it("normalizes display text, line endings, blank optionals, and preserves casing", () => {
    const result = parseApplicationInput({
      ...valid,
      company: "  Cafe\u0301   UK  ",
      location: "  Canary\tWharf ",
      notes: "\r\nFirst\r\nSecond\r\n",
      role: "  Technology   Graduate ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid input.");
    expect(result.value.values).toMatchObject({
      company: "Café UK",
      location: "Canary Wharf",
      notes: "First\nSecond",
      role: "Technology Graduate",
    });
  });

  it("permits applied dates after application deadlines", () => {
    expect(
      parseApplicationInput({
        ...valid,
        appliedDate: "2026-10-02",
        applicationDeadline: "2026-09-30",
      }).ok,
    ).toBe(true);
  });

  it("accepts a controlled or null industry", () => {
    expect(parseApplicationInput({ ...valid, industry: "technology" }).ok).toBe(true);
    expect(parseApplicationInput({ ...valid, industry: null }).ok).toBe(true);
  });
});
