import "server-only";
import { z } from "zod";

import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";

export type AuditEventRecord = Readonly<{
  action: string;
  actorUserId: string;
  createdAt: Date;
  entityId: string | null;
  entityType: string;
  id: string;
  metadata: Record<string, unknown>;
}>;

const AUDIT_PAGE_SIZE = 100;

const auditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

/**
 * Administrator-only audit trail read. Purpose-limited: the audit store holds
 * allow-listed non-sensitive metadata only; this view never touches member
 * records, notes or answers.
 */
export const readAuditEventsForAdmin = (administrator: string, query: unknown) => {
  const parsed = auditQuerySchema.safeParse(query);
  if (!parsed.success)
    return Promise.resolve({ events: [] as readonly AuditEventRecord[], hasNextPage: false });
  const { action, entityType, page } = parsed.data;
  return withApplicationUser(administrator, async (database) => {
    const rows = await database<
      {
        action: string;
        actor_user_id: string;
        created_at: Date;
        entity_id: string | null;
        entity_type: string;
        id: string;
        metadata: Record<string, unknown>;
      }[]
    >`
      select id, actor_user_id, action, entity_type, entity_id, metadata, created_at
      from app.audit_event
      where (${action ?? null}::text is null or action ilike ${`%${action}%`})
        and (${entityType ?? null}::text is null or entity_type ilike ${`%${entityType}%`})
      order by created_at desc, id
      limit ${AUDIT_PAGE_SIZE + 1} offset ${(page - 1) * AUDIT_PAGE_SIZE}
    `;
    const events = rows.slice(0, AUDIT_PAGE_SIZE).map((row) => ({
      action: row.action,
      actorUserId: row.actor_user_id,
      createdAt: row.created_at,
      entityId: row.entity_id,
      entityType: row.entity_type,
      id: row.id,
      metadata: row.metadata,
    }));
    return { events, hasNextPage: rows.length > AUDIT_PAGE_SIZE };
  });
};
