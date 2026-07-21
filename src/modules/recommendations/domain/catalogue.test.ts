import { describe, expect, it } from "vitest";

import { recruitmentStages } from "../../applications/domain/application";
import {
  APPLICATION_RECOMMENDATION_LIMIT,
  assertRecommendationCataloguePrivacy,
  assertRecommendationStageCoverage,
  assertValidRecommendationCatalogue,
  DASHBOARD_RECOMMENDATION_LIMIT,
  recommendationCatalogue,
  type RecommendationDefinition,
} from "./catalogue";

function definition(
  key: string,
  overrides: Partial<RecommendationDefinition> = {},
): RecommendationDefinition {
  return {
    accessibilityLabels: {
      complete: "Mark action as completed.",
      dismiss: "Dismiss action.",
      restore: "Restore action to pending.",
    },
    active: true,
    applicability: [{ active: true }],
    explanationTemplate: "Recommended because this application is being prepared.",
    guidance: "Complete one concrete preparation step.",
    key,
    priority: 100,
    ruleVersion: 1,
    stages: ["preparing"],
    title: "Prepare",
    urgencyEligible: false,
    ...overrides,
  };
}

describe("recommendation catalogue", () => {
  it("uses the founder-approved recommendation limits", () => {
    expect(APPLICATION_RECOMMENDATION_LIMIT).toBe(5);
    expect(DASHBOARD_RECOMMENDATION_LIMIT).toBe(10);
  });

  it("contains the explicit version-one action catalogue", () => {
    expect(recommendationCatalogue.map(({ key }) => key)).toEqual([
      "preparing_confirm_deadline_plan",
      "preparing_tailor_materials",
      "preparing_research_role_employer",
      "applied_preserve_submission",
      "applied_prepare_next_stages",
      "applied_check_response_timing",
      "online_assessment_confirm_deadline",
      "online_assessment_practise_format",
      "online_assessment_check_test_environment",
      "video_interview_prepare_examples",
      "video_interview_practise_recorded_answers",
      "video_interview_check_recording_environment",
      "interview_prepare_evidence_examples",
      "interview_research_context",
      "interview_confirm_format_logistics",
      "assessment_centre_prepare_exercises",
      "assessment_centre_review_context",
      "assessment_centre_confirm_schedule",
      "offer_review_terms_deadline",
      "offer_identify_questions",
      "offer_compare_priorities",
      "rejected_capture_feedback",
      "rejected_choose_improvement",
      "rejected_review_archive_choice",
      "withdrawn_record_reason",
      "withdrawn_review_archive_choice",
      "withdrawn_retain_materials",
    ]);
    expect(recommendationCatalogue.every(({ ruleVersion }) => ruleVersion === 1)).toBe(true);
  });

  it("provides active explicit coverage for all nine approved stages", () => {
    expect(() => assertRecommendationStageCoverage(recommendationCatalogue)).not.toThrow();
    const coveredStages = new Set(recommendationCatalogue.flatMap(({ stages }) => stages));
    expect([...coveredStages].sort()).toEqual(Object.keys(recruitmentStages).sort());
  });

  it("keeps current stable keys unique and compatible with persistence", () => {
    expect(() => assertValidRecommendationCatalogue(recommendationCatalogue)).not.toThrow();
    const keys = recommendationCatalogue.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^[a-z][a-z0-9_]{0,79}$/.test(key))).toBe(true);
  });

  it("rejects duplicate current keys even when their rule versions differ", () => {
    expect(() =>
      assertValidRecommendationCatalogue([
        definition("duplicate_key"),
        definition("duplicate_key", { ruleVersion: 2 }),
      ]),
    ).toThrow("Duplicate current recommendation key");
  });

  it("rejects duplicate matching variants within one stable action", () => {
    expect(() =>
      assertValidRecommendationCatalogue([
        definition("duplicate_variant", {
          applicability: [{ active: true }, { active: false }],
        }),
      ]),
    ).toThrow("Duplicate applicability");
  });

  it("rejects invalid keys, versions, windows and controlled matching values", () => {
    expect(() => assertValidRecommendationCatalogue([definition("contains-hyphen")])).toThrow(
      "Invalid recommendation key",
    );
    expect(() =>
      assertValidRecommendationCatalogue([definition("invalid_version", { ruleVersion: 0 })]),
    ).toThrow("Invalid rule version");
    expect(() =>
      assertValidRecommendationCatalogue([
        definition("invalid_window", {
          applicability: [{ active: true, deadlineWindow: { maximumDays: 2, minimumDays: 3 } }],
        }),
      ]),
    ).toThrow("Invalid deadline window");
    expect(() =>
      assertValidRecommendationCatalogue([
        definition("invalid_stage", { stages: ["screening" as "preparing"] }),
      ]),
    ).toThrow("Unsupported stage");
    expect(() =>
      assertValidRecommendationCatalogue([
        definition("invalid_opportunity", {
          applicability: [{ active: true, opportunityTypes: ["contract" as "graduate_scheme"] }],
        }),
      ]),
    ).toThrow("Unsupported opportunity");
  });

  it("fails when any approved stage loses active coverage", () => {
    const withoutOffer = recommendationCatalogue.filter(({ stages }) => !stages.includes("offer"));
    expect(() => assertRecommendationStageCoverage(withoutOffer)).toThrow(
      "Missing active recommendation coverage for stage: offer",
    );
  });

  it("provides concise programmatic action labels without application values", () => {
    for (const definition of recommendationCatalogue) {
      expect(definition.accessibilityLabels.complete).toContain(definition.title);
      expect(definition.accessibilityLabels.dismiss).toContain(definition.title);
      expect(definition.accessibilityLabels.restore).toContain(definition.title);
      expect(definition.explanationTemplate).not.toMatch(/Deloitte|Graduate Analyst|private note/i);
    }
  });

  it("validates every user-facing field as static catalogue copy", () => {
    expect(() => assertRecommendationCataloguePrivacy(recommendationCatalogue)).not.toThrow();
    for (const item of recommendationCatalogue) {
      for (const value of [
        item.title,
        item.guidance,
        item.explanationTemplate,
        item.accessibilityLabels.complete,
        item.accessibilityLabels.dismiss,
        item.accessibilityLabels.restore,
      ]) {
        expect(typeof value === "string" && value.trim().length > 0).toBe(true);
      }
    }
  });

  it.each([
    ["title", "Prepare ${company}"],
    ["guidance", "Review {{notes}}"],
    ["explanationTemplate", "Matched to <application_id>"],
  ] as const)("rejects a private or unsupported token in %s", (field, value) => {
    expect(() =>
      assertRecommendationCataloguePrivacy([definition("unsafe_copy", { [field]: value })]),
    ).toThrow("Unsafe catalogue");
  });

  it("rejects dynamically generated catalogue text", () => {
    expect(() =>
      assertRecommendationCataloguePrivacy([
        definition("dynamic_copy", {
          guidance: (() => "private") as unknown as string,
        }),
      ]),
    ).toThrow("Unsafe catalogue");
  });
});
