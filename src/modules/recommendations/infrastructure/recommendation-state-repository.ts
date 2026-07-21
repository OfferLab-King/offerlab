import type { TransactionSql } from "postgres";

export type RecommendationState = "pending" | "completed" | "dismissed";

export type RecommendationStateRecord = Readonly<{
  applicationId: string;
  completedAt: Date | null;
  createdAt: Date;
  dismissedAt: Date | null;
  id: string;
  recommendationKey: string;
  ruleVersion: number;
  state: RecommendationState;
  updatedAt: Date;
  version: number;
}>;

type RecommendationStateRow = Readonly<{
  application_id: string;
  completed_at: Date | null;
  created_at: Date;
  dismissed_at: Date | null;
  id: string;
  recommendation_key: string;
  rule_version: number;
  state: RecommendationState;
  updated_at: Date;
  version: number;
}>;

const columns = `
  id, application_id, recommendation_key, rule_version, state, version,
  created_at, updated_at, completed_at, dismissed_at
`;

function record(row: RecommendationStateRow): RecommendationStateRecord {
  return {
    applicationId: row.application_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at,
    id: row.id,
    recommendationKey: row.recommendation_key,
    ruleVersion: row.rule_version,
    state: row.state,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function listRecommendationStates(
  database: TransactionSql,
  ownerId: string,
  applicationIds: readonly string[],
): Promise<readonly RecommendationStateRecord[]> {
  if (applicationIds.length === 0) return [];
  const rows = await database.unsafe<RecommendationStateRow[]>(
    `select ${columns} from app.recommendation_state
     where owner_user_id = $1::uuid and application_id = any($2::uuid[])
     order by application_id, recommendation_key, rule_version`,
    [ownerId, applicationIds],
  );
  return rows.map(record);
}

async function lockState(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
  recommendationKey: string,
  ruleVersion: number,
): Promise<RecommendationStateRecord | null> {
  const rows = await database.unsafe<RecommendationStateRow[]>(
    `select ${columns} from app.recommendation_state
     where owner_user_id = $1::uuid and application_id = $2::uuid
       and recommendation_key = $3 and rule_version = $4
     for update`,
    [ownerId, applicationId, recommendationKey, ruleVersion],
  );
  return rows[0] ? record(rows[0]) : null;
}

export type RecommendationStateMutationOutcome =
  "completed" | "dismissed" | "restored" | "unchanged" | "conflict";

export type RecommendationStateMutationResult =
  | Readonly<{
      outcome: Exclude<RecommendationStateMutationOutcome, "conflict">;
      recommendationState: RecommendationStateRecord | null;
    }>
  | Readonly<{ outcome: "conflict" }>;

async function auditTransition(
  database: TransactionSql,
  ownerId: string,
  recommendationStateId: string,
  outcome: "completed" | "dismissed" | "restored",
): Promise<void> {
  await database`
    insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      ${ownerId}::uuid, ${`recommendation.${outcome}`}, 'recommendation_state',
      ${recommendationStateId}::uuid, '{}'::jsonb
    )
  `;
}

function outcomeFor(targetState: RecommendationState): "completed" | "dismissed" | "restored" {
  if (targetState === "completed") return "completed";
  if (targetState === "dismissed") return "dismissed";
  return "restored";
}

export async function transitionRecommendationState(
  database: TransactionSql,
  input: Readonly<{
    applicationId: string;
    expectedVersion: number | null;
    ownerId: string;
    recommendationKey: string;
    ruleVersion: number;
    targetState: RecommendationState;
  }>,
): Promise<RecommendationStateMutationResult> {
  const current = await lockState(
    database,
    input.ownerId,
    input.applicationId,
    input.recommendationKey,
    input.ruleVersion,
  );

  if (!current) {
    if (input.expectedVersion !== null) return { outcome: "conflict" };
    if (input.targetState === "pending") {
      return { outcome: "unchanged", recommendationState: null };
    }

    const insertedRows = await database<RecommendationStateRow[]>`
      insert into app.recommendation_state (
        owner_user_id, application_id, recommendation_key, rule_version, state
      ) values (
        ${input.ownerId}::uuid, ${input.applicationId}::uuid, ${input.recommendationKey},
        ${input.ruleVersion}, ${input.targetState}
      )
      on conflict (owner_user_id, application_id, recommendation_key, rule_version) do nothing
      returning id, application_id, recommendation_key, rule_version, state, version,
        created_at, updated_at, completed_at, dismissed_at
    `;
    const inserted = insertedRows[0];
    if (!inserted) return { outcome: "conflict" };
    const createdState = record(inserted);
    const outcome = outcomeFor(input.targetState);
    await auditTransition(database, input.ownerId, createdState.id, outcome);
    return { outcome, recommendationState: createdState };
  }

  if (input.expectedVersion === null || current.version !== input.expectedVersion) {
    return { outcome: "conflict" };
  }
  if (current.state === input.targetState) {
    return { outcome: "unchanged", recommendationState: current };
  }

  const updatedRows = await database<RecommendationStateRow[]>`
    update app.recommendation_state
    set state = ${input.targetState}
    where id = ${current.id}::uuid and owner_user_id = ${input.ownerId}::uuid
      and version = ${input.expectedVersion}
    returning id, application_id, recommendation_key, rule_version, state, version,
      created_at, updated_at, completed_at, dismissed_at
  `;
  const updated = updatedRows[0];
  if (!updated) return { outcome: "conflict" };
  const nextState = record(updated);
  const outcome = outcomeFor(input.targetState);
  await auditTransition(database, input.ownerId, nextState.id, outcome);
  return { outcome, recommendationState: nextState };
}
