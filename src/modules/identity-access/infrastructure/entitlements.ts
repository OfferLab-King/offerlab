import type { Sql } from "postgres";

export async function revokeBetaEntitlement(
  database: Sql,
  userId: string,
  actorUserId?: string,
): Promise<void> {
  await database.begin(async (transaction) => {
    const rows = await transaction<{ user_id: string }[]>`
      update app.beta_entitlement
      set status = 'revoked', revoked_at = now(), updated_at = now()
      where user_id = ${userId}::uuid and status = 'active'
      returning user_id
    `;
    if (!rows[0]) throw new Error("An active beta entitlement was not found.");
    await transaction`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${actorUserId ?? null}::uuid,
        'beta_entitlement.revoked',
        'user',
        ${userId}::uuid,
        '{}'::jsonb
      )
    `;
  });
}
