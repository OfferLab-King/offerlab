import type { TransactionSql } from "postgres";

import type { MembershipRecord, MembershipStatus } from "../domain/membership";

type MembershipRow = Readonly<{
  userId: string;
  plan: "membership";
  status: MembershipStatus;
  periodStart: Date;
  periodEnd: Date | null;
  source: "manual" | "stripe" | "test";
  createdAt: Date;
  updatedAt: Date;
}>;

function membershipRecord(row: MembershipRow): MembershipRecord {
  return {
    createdAt: row.createdAt,
    periodEnd: row.periodEnd,
    periodStart: row.periodStart,
    plan: "membership",
    source: row.source,
    status: row.status,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

export async function readMembershipForOwner(
  database: TransactionSql,
  owner: string,
): Promise<MembershipRecord | null> {
  const rows = await database<MembershipRow[]>`
    select user_id as "userId", plan, status, period_start as "periodStart",
      period_end as "periodEnd", source, created_at as "createdAt", updated_at as "updatedAt"
    from app.membership
    where user_id = ${owner}::uuid
    limit 1
  `;
  return rows[0] ? membershipRecord(rows[0]) : null;
}

export async function upsertMembershipForOwner(
  database: TransactionSql,
  owner: string,
  input: Readonly<{
    status: MembershipStatus;
    periodEnd: Date | null;
    source: "manual" | "stripe" | "test";
  }>,
): Promise<MembershipRecord> {
  const rows = await database<MembershipRow[]>`
    insert into app.membership (user_id, plan, status, period_end, source, updated_at)
    values (${owner}::uuid, 'membership', ${input.status}, ${input.periodEnd}, ${input.source}, now())
    on conflict (user_id) do update set
      status = excluded.status,
      period_end = excluded.period_end,
      source = excluded.source,
      updated_at = now()
    returning user_id as "userId", plan, status, period_start as "periodStart",
      period_end as "periodEnd", source, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return membershipRecord(rows[0]!);
}

export async function clearMembershipForOwner(
  database: TransactionSql,
  owner: string,
): Promise<void> {
  await database`
    delete from app.membership where user_id = ${owner}::uuid
  `;
}

export async function readAllMembershipsForAdmin(database: TransactionSql): Promise<
  Readonly<{
    email: string;
    plan: string;
    status: string;
    periodStart: Date;
    periodEnd: Date | null;
    source: string;
    updatedAt: Date;
    userId: string;
  }>[]
> {
  return database<
    {
      email: string;
      plan: string;
      status: string;
      periodStart: Date;
      periodEnd: Date | null;
      source: string;
      updatedAt: Date;
      userId: string;
    }[]
  >`
    select user_id as "userId", email, plan, status, period_start as "periodStart",
      period_end as "periodEnd", source, updated_at as "updatedAt"
    from app.membership_admin_view()
  `;
}
