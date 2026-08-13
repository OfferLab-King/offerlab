import type { TransactionSql } from "postgres";

import type { OnboardingAnswers } from "../domain/onboarding";
import { isOnboardingComplete, onboardingAnswersEqual } from "../domain/onboarding";

export type OnboardingProfile = Readonly<{
  answers: OnboardingAnswers;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type ProfileRow = Readonly<{
  completed_at: Date | null;
  confidence: OnboardingAnswers["confidence"];
  created_at: Date;
  education_stage: OnboardingAnswers["educationStage"];
  industries: OnboardingAnswers["industries"];
  opportunity_types: OnboardingAnswers["opportunityTypes"];
  preparation_priorities: OnboardingAnswers["preparationPriorities"];
  support_needs: OnboardingAnswers["supportNeeds"];
  target_companies: OnboardingAnswers["targetCompanies"];
  target_functions: OnboardingAnswers["targetFunctions"];
  target_industries: OnboardingAnswers["targetIndustries"];
  preferred_locations: OnboardingAnswers["preferredLocations"];
  updated_at: Date;
}>;

function profile(row: ProfileRow): OnboardingProfile {
  return {
    answers: {
      confidence: row.confidence,
      educationStage: row.education_stage,
      industries: row.industries,
      opportunityTypes: row.opportunity_types,
      preparationPriorities: row.preparation_priorities,
      supportNeeds: row.support_needs,
      targetCompanies: row.target_companies,
      targetFunctions: row.target_functions,
      targetIndustries: row.target_industries,
      preferredLocations: row.preferred_locations,
    },
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findOnboardingProfile(
  database: TransactionSql,
  ownerId: string,
): Promise<OnboardingProfile | null> {
  const rows = await database<ProfileRow[]>`
    select education_stage, opportunity_types, industries, preparation_priorities,
      target_companies, target_industries, target_functions, preferred_locations,
      support_needs, confidence, completed_at, created_at, updated_at
    from app.onboarding_profile
    where user_id = ${ownerId}::uuid
  `;
  return rows[0] ? profile(rows[0]) : null;
}

export type SaveOutcome = "completed" | "saved_incomplete" | "unchanged" | "updated";

export type SaveAnalyticsEvent =
  "onboarding_completed" | "onboarding_saved" | "onboarding_started" | "onboarding_updated";

export type SaveOnboardingResult =
  | Readonly<{ ok: false; reason: "incomplete" }>
  | Readonly<{
      analyticsEvent: SaveAnalyticsEvent | null;
      ok: true;
      outcome: SaveOutcome;
      profile: OnboardingProfile;
    }>;

export async function saveOnboardingProfile(
  database: TransactionSql,
  ownerId: string,
  answers: OnboardingAnswers,
  requireCompletion = false,
): Promise<SaveOnboardingResult> {
  await database`
    select pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(${ownerId}, 684104127)
    )
  `;
  const existing = await findOnboardingProfile(database, ownerId);
  const complete = isOnboardingComplete(answers);
  if ((requireCompletion || existing?.completedAt) && !complete) {
    return { ok: false, reason: "incomplete" };
  }
  if (existing && onboardingAnswersEqual(existing.answers, answers)) {
    return { analyticsEvent: null, ok: true, outcome: "unchanged", profile: existing };
  }

  const now = new Date();
  const createdAt = existing?.createdAt ?? now;
  const completedAt = existing?.completedAt ?? (complete ? now : null);
  const outcome: SaveOutcome = existing?.completedAt
    ? "updated"
    : complete
      ? "completed"
      : "saved_incomplete";
  const analyticsEvent: SaveAnalyticsEvent =
    outcome === "completed"
      ? "onboarding_completed"
      : outcome === "updated"
        ? "onboarding_updated"
        : existing
          ? "onboarding_saved"
          : "onboarding_started";

  const rows = await database<ProfileRow[]>`
    insert into app.onboarding_profile (
      user_id, education_stage, opportunity_types, industries, preparation_priorities,
      target_companies, target_industries, target_functions, preferred_locations,
      support_needs, confidence, completed_at, created_at, updated_at
    ) values (
      ${ownerId}::uuid, ${answers.educationStage}, ${answers.opportunityTypes},
      ${answers.industries}, ${answers.preparationPriorities}, ${answers.targetCompanies},
      ${answers.targetIndustries}, ${answers.targetFunctions}, ${answers.preferredLocations},
      ${answers.supportNeeds}, ${answers.confidence}, ${completedAt}, ${createdAt}, ${now}
    )
    on conflict (user_id) do update set
      education_stage = excluded.education_stage,
      opportunity_types = excluded.opportunity_types,
      industries = excluded.industries,
      target_industries = excluded.target_industries,
      target_functions = excluded.target_functions,
      preferred_locations = excluded.preferred_locations,
      preparation_priorities = excluded.preparation_priorities,
      target_companies = excluded.target_companies,
      support_needs = excluded.support_needs,
      confidence = excluded.confidence,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at
    where app.onboarding_profile.user_id = ${ownerId}::uuid
    returning education_stage, opportunity_types, industries, preparation_priorities,
      target_companies, support_needs, confidence, completed_at, created_at, updated_at
  `;
  const saved = rows[0];
  if (!saved) throw new Error("onboarding_save_failed");

  if (outcome === "completed" || outcome === "updated") {
    await database`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${ownerId}::uuid,
        ${outcome === "completed" ? "onboarding.completed" : "onboarding.updated"},
        'onboarding_profile', ${ownerId}::uuid, '{}'::jsonb
      )
    `;
  }
  return { analyticsEvent, ok: true, outcome, profile: profile(saved) };
}
