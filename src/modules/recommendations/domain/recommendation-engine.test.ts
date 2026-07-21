import { describe, expect, it } from "vitest";

import { recruitmentStages, type RecruitmentStage } from "../../applications/domain/application";
import type { RecommendationDefinition } from "./catalogue";
import {
  evaluateApplicationRecommendations,
  evaluateDashboardRecommendations,
  findRecommendationDefinition,
  londonCalendarDate,
  resolveApplicationRecommendation,
  type EvaluatedRecommendation,
  type RecommendationApplication,
  type RecommendationClock,
} from "./recommendation-engine";

const frozenClock: RecommendationClock = {
  now: () => new Date("2026-07-20T12:00:00.000Z"),
};

function application(
  overrides: Partial<RecommendationApplication> = {},
): RecommendationApplication {
  return {
    appliedDate: "2026-07-10",
    applicationDeadline: null,
    archivedAt: null,
    id: "application-a",
    nextStageDeadline: null,
    opportunityType: "entry_level_role",
    stage: "preparing",
    ...overrides,
  };
}

function definition(
  key: string,
  overrides: Partial<RecommendationDefinition> = {},
): RecommendationDefinition {
  return {
    accessibilityLabels: {
      complete: `Complete ${key}.`,
      dismiss: `Dismiss ${key}.`,
      restore: `Restore ${key}.`,
    },
    active: true,
    applicability: [{ active: true }],
    explanationTemplate: "Recommended because this application is being prepared.",
    guidance: "Complete one concrete preparation step.",
    key,
    priority: 100,
    ruleVersion: 1,
    stages: ["preparing"],
    title: key,
    urgencyEligible: false,
    ...overrides,
  };
}

function byKey(
  recommendations: readonly EvaluatedRecommendation[],
  key: string,
): EvaluatedRecommendation {
  const recommendation = recommendations.find((item) => item.identity.key === key);
  if (!recommendation) throw new Error(`Missing test recommendation: ${key}`);
  return recommendation;
}

describe("deterministic recommendation engine", () => {
  it.each(Object.keys(recruitmentStages) as RecruitmentStage[])(
    "has explicit evaluated coverage for %s",
    (stage) => {
      const recommendations = evaluateApplicationRecommendations(application({ stage }), {
        clock: frozenClock,
      });
      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.every((recommendation) =>
          recommendation.identity.key.startsWith(`${stage}_`),
        ),
      ).toBe(true);
    },
  );

  it("rejects an unsupported runtime stage instead of silently using a fallback", () => {
    expect(() =>
      evaluateApplicationRecommendations(application({ stage: "screening" as RecruitmentStage }), {
        clock: frozenClock,
      }),
    ).toThrow("Unsupported recommendation stage");
  });

  it("returns no fallback when a valid stage has no definition in a supplied catalogue", () => {
    expect(
      evaluateApplicationRecommendations(application({ stage: "offer" }), {
        catalogue: [definition("preparing_only")],
        clock: frozenClock,
      }),
    ).toEqual([]);
  });

  it("is stable for identical applications, catalogue and clock", () => {
    const input = application({
      applicationDeadline: "2026-07-25",
      opportunityType: "graduate_scheme",
    });
    const first = evaluateApplicationRecommendations(input, { clock: frozenClock });
    const second = evaluateApplicationRecommendations(input, { clock: frozenClock });
    expect(second).toEqual(first);
  });

  it("uses opportunity type as an approved specificity input with a generic fallback", () => {
    const graduate = evaluateApplicationRecommendations(
      application({ opportunityType: "graduate_scheme" }),
      { clock: frozenClock },
    );
    const entryLevel = evaluateApplicationRecommendations(
      application({ opportunityType: "entry_level_role" }),
      { clock: frozenClock },
    );
    expect(graduate[0]?.identity.key).toBe("preparing_tailor_materials");
    expect(entryLevel[0]?.identity.key).toBe("preparing_confirm_deadline_plan");
    expect(new Set(graduate.map(({ identity }) => identity.key))).toEqual(
      new Set(entryLevel.map(({ identity }) => identity.key)),
    );
  });

  it("orders ADR specificity before priority", () => {
    const genericHighPriority = definition("generic_high_priority", { priority: 999 });
    const specificLowPriority = definition("specific_low_priority", {
      applicability: [
        {
          active: true,
          deadlineWindow: { maximumDays: 7, minimumDays: 0 },
          opportunityTypes: ["graduate_scheme"],
        },
      ],
      priority: 1,
      urgencyEligible: true,
    });
    const result = evaluateApplicationRecommendations(
      application({
        applicationDeadline: "2026-07-25",
        opportunityType: "graduate_scheme",
      }),
      { catalogue: [genericHighPriority, specificLowPriority], clock: frozenClock },
    );
    expect(result.map(({ identity }) => identity.key)).toEqual([
      "specific_low_priority",
      "generic_high_priority",
    ]);
  });

  it("orders priority before urgency when specificity is equal", () => {
    const window = { maximumDays: 7, minimumDays: 0 };
    const catalogue = [
      definition("priority_high", {
        applicability: [{ active: true, deadlineWindow: window }],
        priority: 200,
        urgencyEligible: true,
      }),
      definition("priority_low", {
        applicability: [{ active: true, deadlineWindow: window }],
        priority: 100,
        urgencyEligible: true,
      }),
    ];
    const result = evaluateDashboardRecommendations(
      [
        application({ applicationDeadline: "2026-07-21", id: "urgent-application" }),
        application({ applicationDeadline: "2026-07-25", id: "high-application" }),
      ],
      {
        catalogue,
        clock: frozenClock,
        include: ({ identity }) =>
          (identity.applicationId === "high-application" && identity.key === "priority_high") ||
          (identity.applicationId === "urgent-application" && identity.key === "priority_low"),
      },
    );
    expect(result.map(({ identity }) => identity.key)).toEqual(["priority_high", "priority_low"]);
    expect(result.map(({ urgency }) => urgency)).toEqual(["high", "urgent"]);
  });

  it("uses urgency, deadline, stable key and application ID as successive tie-breakers", () => {
    const window = { maximumDays: 7, minimumDays: 0 };
    const tiedCatalogue = [
      definition("a_action", {
        applicability: [{ active: true, deadlineWindow: window }],
        urgencyEligible: true,
      }),
      definition("z_action", {
        applicability: [{ active: true, deadlineWindow: window }],
        urgencyEligible: true,
      }),
    ];

    const urgency = evaluateDashboardRecommendations(
      [
        application({ applicationDeadline: "2026-07-25", id: "a-high" }),
        application({ applicationDeadline: "2026-07-23", id: "z-urgent" }),
      ],
      {
        catalogue: tiedCatalogue,
        clock: frozenClock,
        include: ({ identity }) => identity.key === "a_action",
      },
    );
    expect(urgency.map(({ identity }) => identity.applicationId)).toEqual(["z-urgent", "a-high"]);

    const deadline = evaluateDashboardRecommendations(
      [
        application({ applicationDeadline: "2026-07-23", id: "a-later" }),
        application({ applicationDeadline: "2026-07-21", id: "z-earlier" }),
      ],
      {
        catalogue: tiedCatalogue,
        clock: frozenClock,
        include: ({ identity }) =>
          (identity.applicationId === "a-later" && identity.key === "a_action") ||
          (identity.applicationId === "z-earlier" && identity.key === "z_action"),
      },
    );
    expect(deadline.map(({ identity }) => identity.applicationId)).toEqual([
      "z-earlier",
      "a-later",
    ]);

    const stableKey = evaluateApplicationRecommendations(
      application({ applicationDeadline: "2026-07-21" }),
      { catalogue: tiedCatalogue, clock: frozenClock },
    );
    expect(stableKey.map(({ identity }) => identity.key)).toEqual(["a_action", "z_action"]);

    const applicationId = evaluateDashboardRecommendations(
      [
        application({ applicationDeadline: "2026-07-21", id: "application-z" }),
        application({ applicationDeadline: "2026-07-21", id: "application-a" }),
      ],
      {
        catalogue: [tiedCatalogue[0]!],
        clock: frozenClock,
      },
    );
    expect(applicationId.map(({ identity }) => identity.applicationId)).toEqual([
      "application-a",
      "application-z",
    ]);
  });

  it("deduplicates a stable action even when several variants match", () => {
    const recommendations = evaluateApplicationRecommendations(
      application({
        applicationDeadline: "2026-07-21",
        opportunityType: "graduate_scheme",
      }),
      { clock: frozenClock },
    );
    const keys = recommendations.map(({ identity }) => identity.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key === "preparing_tailor_materials")).toHaveLength(1);
  });

  it("does not duplicate an identity when aggregate input repeats an application", () => {
    const repeated = application({ id: "repeated-application" });
    const recommendations = evaluateDashboardRecommendations([repeated, repeated], {
      clock: frozenClock,
    });
    const identities = recommendations.map(({ identity }) => JSON.stringify(identity));
    expect(new Set(identities).size).toBe(identities.length);
    expect(recommendations).toHaveLength(3);
  });

  it("excludes inactive definitions and inactive matching variants", () => {
    const result = evaluateApplicationRecommendations(application(), {
      catalogue: [
        definition("inactive_definition", { active: false }),
        definition("inactive_variant", { applicability: [{ active: false }] }),
        definition("active_definition"),
      ],
      clock: frozenClock,
    });
    expect(result.map(({ identity }) => identity.key)).toEqual(["active_definition"]);
  });

  it("hard-caps application results at five and dashboard results at ten", () => {
    const largeCatalogue = Array.from({ length: 8 }, (_, index) =>
      definition(`action_${index}`, { priority: 100 - index }),
    );
    const oneApplication = evaluateApplicationRecommendations(application(), {
      catalogue: largeCatalogue,
      clock: frozenClock,
      limit: 999,
    });
    expect(oneApplication).toHaveLength(5);

    const dashboard = evaluateDashboardRecommendations(
      [
        application({ id: "application-a" }),
        application({ id: "application-b" }),
        application({ id: "application-c" }),
      ],
      { catalogue: largeCatalogue, clock: frozenClock, limit: 999 },
    );
    expect(dashboard).toHaveLength(10);
    const counts = new Map<string, number>();
    for (const recommendation of dashboard) {
      const id = recommendation.identity.applicationId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.values()].every((count) => count <= 5)).toBe(true);
  });

  it("filters state before applying application and dashboard limits", () => {
    const largeCatalogue = Array.from({ length: 8 }, (_, index) =>
      definition(`action_${index}`, { priority: 100 - index }),
    );
    const include = ({ identity }: EvaluatedRecommendation) =>
      !["action_0", "action_1", "action_2"].includes(identity.key);
    const applicationResult = evaluateApplicationRecommendations(application(), {
      catalogue: largeCatalogue,
      clock: frozenClock,
      include,
    });
    expect(applicationResult.map(({ identity }) => identity.key)).toEqual([
      "action_3",
      "action_4",
      "action_5",
      "action_6",
      "action_7",
    ]);
    const dashboardResult = evaluateDashboardRecommendations(
      [application({ id: "application-a" }), application({ id: "application-b" })],
      { catalogue: largeCatalogue, clock: frozenClock, include },
    );
    expect(dashboardResult).toHaveLength(10);
  });

  it.each([
    ["2026-07-19", "urgent", "has passed"],
    ["2026-07-20", "urgent", "is today"],
    ["2026-07-23", "urgent", "within three calendar days"],
    ["2026-07-24", "high", "within seven calendar days"],
    ["2026-07-27", "high", "within seven calendar days"],
    ["2026-07-28", "normal", "currently being prepared"],
    [null, "normal", "currently being prepared"],
  ] as const)(
    "classifies application deadline %s as %s",
    (applicationDeadline, expectedUrgency, explanation) => {
      const recommendations = evaluateApplicationRecommendations(
        application({ applicationDeadline }),
        { clock: frozenClock },
      );
      const recommendation = byKey(recommendations, "preparing_confirm_deadline_plan");
      expect(recommendation.urgency).toBe(expectedUrgency);
      expect(recommendation.explanation).toContain(explanation);
    },
  );

  it.each([
    ["2026-07-19", "urgent"],
    ["2026-07-20", "urgent"],
    ["2026-07-23", "urgent"],
    ["2026-07-24", "high"],
    ["2026-07-27", "high"],
    ["2026-07-28", "normal"],
  ] as const)("classifies next-stage deadline %s as %s", (nextStageDeadline, urgency) => {
    const recommendations = evaluateApplicationRecommendations(
      application({ applicationDeadline: "2026-07-21", nextStageDeadline }),
      { clock: frozenClock },
    );
    expect(byKey(recommendations, "preparing_confirm_deadline_plan").urgency).toBe(urgency);
  });

  it("keeps a past next-stage deadline urgent while using a future application deadline for matching", () => {
    const fallbackRule = definition("fallback_window", {
      applicability: [{ active: true, deadlineWindow: { maximumDays: 7, minimumDays: 4 } }],
      urgencyEligible: true,
    });
    const fallback = evaluateApplicationRecommendations(
      application({
        applicationDeadline: "2026-07-25",
        nextStageDeadline: "2026-07-19",
      }),
      { catalogue: [fallbackRule], clock: frozenClock },
    );
    expect(fallback).toHaveLength(1);
    expect(fallback[0]).toMatchObject({ urgency: "urgent" });
    expect(fallback[0]?.explanation).toContain("next-stage deadline has passed");

    const noFutureFallback = evaluateApplicationRecommendations(
      application({
        applicationDeadline: "2026-07-18",
        nextStageDeadline: "2026-07-19",
      }),
      { catalogue: [fallbackRule], clock: frozenClock },
    );
    expect(noFutureFallback).toEqual([]);
  });

  it("orders equal urgent recommendations by the eligible ADR 0008 fallback deadline", () => {
    const fallbackRule = definition("fallback_order", {
      applicability: [{ active: true, deadlineWindow: { maximumDays: 30, minimumDays: 0 } }],
      urgencyEligible: true,
    });
    const laterFallback = application({
      applicationDeadline: "2026-07-30",
      id: "application-a",
      nextStageDeadline: "2026-07-18",
    });
    const earlierFallback = application({
      applicationDeadline: "2026-07-25",
      id: "application-z",
      nextStageDeadline: "2026-07-19",
    });
    const result = evaluateDashboardRecommendations([laterFallback, earlierFallback], {
      catalogue: [fallbackRule],
      clock: frozenClock,
    });
    expect(result.map(({ identity }) => identity.applicationId)).toEqual([
      "application-z",
      "application-a",
    ]);
    expect(result.every(({ urgency }) => urgency === "urgent")).toBe(true);
    expect(
      result.every(({ explanation }) => explanation.includes("next-stage deadline has passed")),
    ).toBe(true);
  });

  it("lets a future next-stage deadline win over the application deadline", () => {
    const fourToSevenDayRule = definition("future_window", {
      applicability: [{ active: true, deadlineWindow: { maximumDays: 7, minimumDays: 4 } }],
      urgencyEligible: true,
    });
    const result = evaluateApplicationRecommendations(
      application({
        applicationDeadline: "2026-07-25",
        nextStageDeadline: "2026-07-28",
      }),
      { catalogue: [fourToSevenDayRule], clock: frozenClock },
    );
    expect(result).toEqual([]);
  });

  it("matches only unwindowed rules with no future or today deadline", () => {
    const windowed = definition("windowed", {
      applicability: [{ active: true, deadlineWindow: { maximumDays: 7, minimumDays: 0 } }],
      urgencyEligible: true,
    });
    const unwindowed = definition("unwindowed", { urgencyEligible: true });
    const noDeadline = evaluateApplicationRecommendations(application(), {
      catalogue: [windowed, unwindowed],
      clock: frozenClock,
    });
    expect(noDeadline.map(({ identity }) => identity.key)).toEqual(["unwindowed"]);
    expect(noDeadline[0]?.urgency).toBe("normal");

    const pastApplicationDeadline = evaluateApplicationRecommendations(
      application({ applicationDeadline: "2026-07-19" }),
      { catalogue: [windowed, unwindowed], clock: frozenClock },
    );
    expect(pastApplicationDeadline.map(({ identity }) => identity.key)).toEqual(["unwindowed"]);
    expect(pastApplicationDeadline[0]?.urgency).toBe("urgent");
  });

  it("never treats applied date as a deadline or ranking input", () => {
    const early = evaluateApplicationRecommendations(application({ appliedDate: "2020-01-01" }), {
      clock: frozenClock,
    });
    const late = evaluateApplicationRecommendations(application({ appliedDate: "2026-12-31" }), {
      clock: frozenClock,
    });
    expect(late).toEqual(early);
  });

  it("uses one injected London clock reading for a dashboard evaluation", () => {
    let calls = 0;
    const clock: RecommendationClock = {
      now: () => {
        calls += 1;
        return new Date("2026-07-20T23:30:00.000Z");
      },
    };
    const result = evaluateDashboardRecommendations(
      [
        application({ applicationDeadline: "2026-07-21", id: "application-a" }),
        application({ applicationDeadline: "2026-07-21", id: "application-b" }),
      ],
      { clock },
    );
    expect(calls).toBe(1);
    expect(result.every(({ explanation }) => explanation.includes("is today"))).toBe(true);
  });

  it("calculates calendar dates at London midnight and across BST transitions", () => {
    expect(londonCalendarDate(new Date("2026-07-20T22:59:59.999Z"))).toBe("2026-07-20");
    expect(londonCalendarDate(new Date("2026-07-20T23:00:00.000Z"))).toBe("2026-07-21");
    expect(londonCalendarDate(new Date("2026-03-29T23:30:00.000Z"))).toBe("2026-03-30");
    expect(londonCalendarDate(new Date("2026-10-25T23:30:00.000Z"))).toBe("2026-10-25");
  });

  it("returns no active recommendations for an archived application", () => {
    const archived = application({ archivedAt: new Date("2026-07-20T10:00:00.000Z") });
    expect(evaluateApplicationRecommendations(archived, { clock: frozenClock })).toEqual([]);
    expect(evaluateDashboardRecommendations([archived], { clock: frozenClock })).toEqual([]);
    expect(
      resolveApplicationRecommendation(archived, "preparing_confirm_deadline_plan", 1, {
        clock: frozenClock,
      }),
    ).toBeNull();
  });

  it("does not copy private application content into generated output", () => {
    const privateApplication = {
      ...application(),
      company: "Unique Secret Employer",
      industry: "technology",
      location: "Secret Location",
      notes: "Unique private note",
      role: "Unique Secret Role",
    } as const;
    const generated = JSON.stringify(
      evaluateApplicationRecommendations(privateApplication, { clock: frozenClock }),
    );
    expect(generated).not.toContain(privateApplication.company);
    expect(generated).not.toContain(privateApplication.location);
    expect(generated).not.toContain(privateApplication.notes);
    expect(generated).not.toContain(privateApplication.role);
  });

  it("bases identity only on application, stable key and explicit rule version", () => {
    const versionOne = definition("versioned_action", { ruleVersion: 1, title: "First wording" });
    const copyOnlyChange = definition("versioned_action", {
      guidance: "Reworded guidance.",
      ruleVersion: 1,
      title: "Second wording",
    });
    const versionTwo = definition("versioned_action", { ruleVersion: 2, title: "Material change" });
    const identityOne = evaluateApplicationRecommendations(application(), {
      catalogue: [versionOne],
      clock: frozenClock,
    })[0]?.identity;
    const copyIdentity = evaluateApplicationRecommendations(application(), {
      catalogue: [copyOnlyChange],
      clock: frozenClock,
    })[0]?.identity;
    const identityTwo = evaluateApplicationRecommendations(application(), {
      catalogue: [versionTwo],
      clock: frozenClock,
    })[0]?.identity;
    expect(copyIdentity).toEqual(identityOne);
    expect(identityTwo).toEqual({
      applicationId: "application-a",
      key: "versioned_action",
      ruleVersion: 2,
    });
    expect(identityTwo).not.toEqual(identityOne);
    expect(findRecommendationDefinition("versioned_action", 1, [versionOne])).toBe(versionOne);
    expect(findRecommendationDefinition("versioned_action", 2, [versionOne])).toBeNull();
  });

  it("resolves exact current applicability independently of the display cap", () => {
    const largeCatalogue = Array.from({ length: 7 }, (_, index) =>
      definition(`action_${index}`, { priority: 100 - index }),
    );
    expect(
      resolveApplicationRecommendation(application(), "action_6", 1, {
        catalogue: largeCatalogue,
        clock: frozenClock,
      })?.identity.key,
    ).toBe("action_6");
    expect(
      resolveApplicationRecommendation(application({ stage: "offer" }), "action_6", 1, {
        catalogue: largeCatalogue,
        clock: frozenClock,
      }),
    ).toBeNull();
    expect(
      resolveApplicationRecommendation(application(), "action_6", 2, {
        catalogue: largeCatalogue,
        clock: frozenClock,
      }),
    ).toBeNull();
  });

  it("rejects malformed date-only inputs and invalid clock values", () => {
    expect(() =>
      evaluateApplicationRecommendations(application({ applicationDeadline: "2026-02-30" }), {
        clock: frozenClock,
      }),
    ).toThrow("Invalid recommendation date input");
    expect(() => londonCalendarDate(new Date("invalid"))).toThrow(
      "Invalid recommendation clock instant",
    );
  });
});
