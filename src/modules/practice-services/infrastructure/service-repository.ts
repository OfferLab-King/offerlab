import type { TransactionSql } from "postgres";

type OfferingRow = Readonly<{
  availability: "interest" | "scheduled" | "open" | "paused";
  delivery_mode: "online" | "asynchronous";
  ends_at: string | null;
  id: string;
  offering_type: string;
  request_id: string | null;
  request_status: "requested" | "confirmed" | "completed" | "cancelled" | null;
  request_version: number | null;
  starts_at: string | null;
  summary: string;
  title: string;
  turnaround_days: number | null;
}>;
export type AdminServiceRequest = Readonly<{
  created_at: string;
  id: string;
  offering_title: string;
  offering_type: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  version: number;
}>;
type RequestRow = Readonly<{
  id: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  version: number;
}>;
export type AdminServiceOffering = Readonly<{
  availability: "interest" | "scheduled" | "open" | "paused";
  id: string;
  title: string;
  version: number;
}>;
export type ServiceOffering = Readonly<{
  availability: "interest" | "scheduled" | "open" | "paused";
  deliveryMode: "online" | "asynchronous";
  endsAt: string | null;
  id: string;
  offeringType: string;
  requestId: string | null;
  requestStatus: "requested" | "confirmed" | "completed" | "cancelled" | null;
  requestVersion: number | null;
  startsAt: string | null;
  summary: string;
  title: string;
  turnaroundDays: number | null;
}>;

const offering = (row: OfferingRow): ServiceOffering => ({
  availability: row.availability,
  deliveryMode: row.delivery_mode,
  endsAt: row.ends_at,
  id: row.id,
  offeringType: row.offering_type,
  requestId: row.request_id,
  requestStatus: row.request_status,
  requestVersion: row.request_version,
  startsAt: row.starts_at,
  summary: row.summary,
  title: row.title,
  turnaroundDays: row.turnaround_days,
});

export async function listOfferings(db: TransactionSql, owner: string) {
  const rows = await db<
    OfferingRow[]
  >`select o.*,r.id request_id,r.status request_status,r.version request_version
    from app.service_offering o left join app.service_request r
    on r.offering_id=o.id and r.owner_user_id=${owner}::uuid
    where o.availability<>'paused' order by o.position,o.id`;
  return rows.map(offering);
}

export async function createRequest(db: TransactionSql, owner: string, offeringId: string) {
  const existing = await db<
    RequestRow[]
  >`select * from app.service_request where owner_user_id=${owner}::uuid and offering_id=${offeringId}::uuid`;
  if (existing[0]) {
    if (existing[0].status !== "cancelled") return { outcome: "unchanged" } as const;
    await db`update app.service_request set status='requested' where id=${existing[0].id}::uuid`;
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
      values(${owner}::uuid,'service.requested','service_request',${existing[0].id}::uuid,'{}'::jsonb)`;
    return { outcome: "changed" } as const;
  }
  const rows = await db<{ id: string }[]>`insert into app.service_request(owner_user_id,offering_id)
    select ${owner}::uuid,id from app.service_offering where id=${offeringId}::uuid and availability<>'paused'
    returning id`;
  if (!rows[0]) return { outcome: "not_found" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'service.requested','service_request',${rows[0].id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function cancelRequest(
  db: TransactionSql,
  owner: string,
  id: string,
  expectedVersion: number,
) {
  const rows = await db<
    RequestRow[]
  >`select * from app.service_request where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  if (!rows[0]) return { outcome: "not_found" } as const;
  if (rows[0].version !== expectedVersion) return { outcome: "conflict" } as const;
  if (rows[0].status === "cancelled") return { outcome: "unchanged" } as const;
  if (!["requested", "confirmed"].includes(rows[0].status)) return { outcome: "invalid" } as const;
  await db`update app.service_request set status='cancelled' where id=${id}::uuid`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'service.cancelled','service_request',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function listRequestsForAdmin(db: TransactionSql) {
  return db<
    AdminServiceRequest[]
  >`select r.id,r.status,r.version,r.created_at,o.title offering_title,o.offering_type
    from app.service_request r join app.service_offering o on o.id=r.offering_id
    order by case r.status when 'requested' then 0 when 'confirmed' then 1 else 2 end,r.created_at,r.id`;
}

export const listOfferingsForAdmin = (db: TransactionSql) =>
  db<
    AdminServiceOffering[]
  >`select id,title,availability,version from app.service_offering order by position,id`;

export async function updateOfferingAvailability(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  availability: "interest" | "open" | "paused",
) {
  const rows = await db<
    { availability: string; version: number }[]
  >`select availability,version from app.service_offering where id=${id}::uuid`;
  if (!rows[0]) return { outcome: "not_found" } as const;
  if (rows[0].version !== expectedVersion) return { outcome: "conflict" } as const;
  if (rows[0].availability === availability) return { outcome: "unchanged" } as const;
  await db`update app.service_offering set availability=${availability} where id=${id}::uuid`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'service.availability_updated','service_offering',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function updateRequest(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  status: "confirmed" | "completed" | "cancelled",
) {
  const rows = await db<
    RequestRow[]
  >`select id,status,version from app.service_request where id=${id}::uuid`;
  if (!rows[0]) return { outcome: "not_found" } as const;
  if (rows[0].version !== expectedVersion) return { outcome: "conflict" } as const;
  if (rows[0].status === status) return { outcome: "unchanged" } as const;
  await db`update app.service_request set status=${status} where id=${id}::uuid`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,${`service.${status === "cancelled" ? "cancelled" : status}`},'service_request',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}
