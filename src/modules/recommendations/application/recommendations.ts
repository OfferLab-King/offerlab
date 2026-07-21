import "server-only";

import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  lockApplicationForRecommendationMutation,
  type RecommendationApplicationContext,
} from "../../applications/application/applications";
import {
  evaluateAllApplicationRecommendations,
  evaluateDashboardRecommendations,
  findRecommendationDefinition,
  resolveApplicationRecommendation,
  type EvaluatedRecommendation,
  type RecommendationClock,
} from "../domain/recommendation-engine";
import {
  APPLICATION_RECOMMENDATION_LIMIT,
  type RecommendationDefinition,
} from "../domain/catalogue";
import {
  listRecommendationStates,
  transitionRecommendationState,
  type RecommendationState,
  type RecommendationStateRecord,
} from "../infrastructure/recommendation-state-repository";
import type { RecommendationMutationInput } from "./request";

export type MemberRecommendation = EvaluatedRecommendation &
  Readonly<{
    state: RecommendationState;
    stateVersion: number | null;
  }>;

function identityKey(applicationId: string, key: string, ruleVersion: number): string {
  return `${applicationId}\u0000${key}\u0000${ruleVersion}`;
}

function stateIndex(
  states: readonly RecommendationStateRecord[],
): ReadonlyMap<string, RecommendationStateRecord> {
  return new Map(
    states.map((state) => [
      identityKey(state.applicationId, state.recommendationKey, state.ruleVersion),
      state,
    ]),
  );
}

function withState(
  recommendation: EvaluatedRecommendation,
  states: ReadonlyMap<string, RecommendationStateRecord>,
): MemberRecommendation {
  const persisted = states.get(
    identityKey(
      recommendation.identity.applicationId,
      recommendation.identity.key,
      recommendation.identity.ruleVersion,
    ),
  );
  return {
    ...recommendation,
    state: persisted?.state ?? "pending",
    stateVersion: persisted?.version ?? null,
  };
}

function expectedResourceKey(slug: string): string {
  return slug.replaceAll("-", "_");
}
async function availableRecommendationSlugs(
  ownerId: string,
  recommendations: readonly EvaluatedRecommendation[],
): Promise<ReadonlySet<string>> {
  const expected = new Map(
    recommendations.map((item) => [item.resourceSlug, expectedResourceKey(item.resourceSlug)]),
  );
  if (expected.size === 0) return new Set();
  const rows = await withApplicationUser(
    ownerId,
    (database) => database<{ resourceKey: string; slug: string }[]>`
    select r.resource_key "resourceKey",r.slug from app.preparation_resource r
    join app.content_category c on c.id=r.primary_category_id and c.archived_at is null
    where r.publication_state='published' and r.archived_at is null and r.slug=any(${[...expected.keys()]}::text[])
  `,
  );
  return new Set(
    rows.filter((row) => expected.get(row.slug) === row.resourceKey).map((row) => row.slug),
  );
}

async function retainAvailable(
  ownerId: string,
  recommendations: readonly EvaluatedRecommendation[],
) {
  const available = await availableRecommendationSlugs(ownerId, recommendations);
  return recommendations.filter((item) => available.has(item.resourceSlug));
}

async function readStates(
  ownerId: string,
  applications: readonly RecommendationApplicationContext[],
): Promise<ReadonlyMap<string, RecommendationStateRecord>> {
  const states = await withApplicationUser(ownerId, (database) =>
    listRecommendationStates(
      database,
      ownerId,
      applications.map(({ id }) => id),
    ),
  );
  return stateIndex(states);
}

export async function readApplicationRecommendations(
  ownerId: string,
  application: RecommendationApplicationContext,
  clock?: RecommendationClock,
  catalogue?: readonly RecommendationDefinition[],
): Promise<readonly MemberRecommendation[]> {
  if (application.archivedAt) return [];
  const states = await readStates(ownerId, [application]);
  const evaluated = await retainAvailable(
    ownerId,
    evaluateAllApplicationRecommendations(application, {
      ...(catalogue ? { catalogue } : {}),
      ...(clock ? { clock } : {}),
    }),
  );
  const evaluatedWithState = evaluated.map((recommendation) => withState(recommendation, states));
  const pending = evaluatedWithState
    .filter(({ state }) => state === "pending")
    .slice(0, APPLICATION_RECOMMENDATION_LIMIT);
  const completed = evaluatedWithState.filter(({ state }) => state === "completed");
  const dismissed = evaluatedWithState.filter(({ state }) => state === "dismissed");
  return [...pending, ...completed, ...dismissed];
}

export async function readDashboardRecommendations(
  ownerId: string,
  applications: readonly RecommendationApplicationContext[],
  clock?: RecommendationClock,
): Promise<readonly MemberRecommendation[]> {
  const activeApplications = applications.filter(({ archivedAt }) => !archivedAt);
  if (activeApplications.length === 0) return [];
  const states = await readStates(ownerId, activeApplications);
  const evaluated = await retainAvailable(
    ownerId,
    evaluateDashboardRecommendations(activeApplications, {
      ...(clock ? { clock } : {}),
      include: (recommendation) =>
        (states.get(
          identityKey(
            recommendation.identity.applicationId,
            recommendation.identity.key,
            recommendation.identity.ruleVersion,
          ),
        )?.state ?? "pending") === "pending",
    }),
  );
  return evaluated.map((recommendation) => withState(recommendation, states));
}

export type RecommendationMutationResult =
  | Readonly<{
      outcome: "completed" | "dismissed" | "restored" | "unchanged";
      stateVersion: number | null;
    }>
  | Readonly<{
      outcome: "conflict" | "invalid" | "not_applicable" | "not_found";
    }>;

const analyticsByOutcome = {
  completed: "recommendation_completed",
  dismissed: "recommendation_dismissed",
  restored: "recommendation_restored",
} as const;

export async function mutateRecommendationState(
  ownerId: string,
  applicationId: string,
  input: RecommendationMutationInput,
  clock?: RecommendationClock,
): Promise<RecommendationMutationResult> {
  const result = await withApplicationUser(ownerId, async (database) => {
    const application = await lockApplicationForRecommendationMutation(
      database,
      ownerId,
      applicationId,
    );
    if (!application) return { outcome: "not_found" } as const;
    if (application.archivedAt) return { outcome: "not_applicable" } as const;

    const definition = findRecommendationDefinition(input.recommendationKey, input.ruleVersion);
    if (!definition) return { outcome: "invalid" } as const;
    const currentRecommendation = resolveApplicationRecommendation(
      application,
      input.recommendationKey,
      input.ruleVersion,
      clock ? { clock } : {},
    );
    if (!currentRecommendation) return { outcome: "not_applicable" } as const;
    const expectedKey = expectedResourceKey(currentRecommendation.resourceSlug);
    const target = await database<{ found: boolean }[]>`select exists(
      select 1 from app.preparation_resource r join app.content_category c on c.id=r.primary_category_id and c.archived_at is null
      where r.resource_key=${expectedKey} and r.slug=${currentRecommendation.resourceSlug} and r.publication_state='published' and r.archived_at is null
    ) found`;
    if (!target[0]?.found) return { outcome: "not_applicable" } as const;

    const transition = await transitionRecommendationState(database, {
      applicationId,
      expectedVersion: input.expectedVersion,
      ownerId,
      recommendationKey: input.recommendationKey,
      ruleVersion: input.ruleVersion,
      targetState: input.targetState,
    });
    if (transition.outcome === "conflict") return transition;
    return {
      outcome: transition.outcome,
      stateVersion: transition.recommendationState?.version ?? null,
    } as const;
  });

  if (result.outcome in analyticsByOutcome) {
    await captureAnalyticsEvent(
      analyticsByOutcome[result.outcome as keyof typeof analyticsByOutcome],
    );
  }
  return result;
}
