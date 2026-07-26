import type { TransactionSql } from "postgres";
import {
  communityTermsVersion,
  type CommentFlagReason,
  type CommentInput,
} from "../domain/community";

export type CommentModerationState = "pending" | "published" | "rejected" | "removed";

type CommentRow = Readonly<{
  body: string;
  created_at: Date | string;
  id: string;
  moderation_state: CommentModerationState;
  owner_user_id: string;
  parent_comment_id: string | null;
  report_author: boolean;
  report_id: string;
  version: number;
}>;

export type IntelligenceComment = Readonly<{
  body: string;
  createdAt: string;
  id: string;
  mine: boolean;
  moderationState: CommentModerationState;
  parentCommentId: string | null;
  reportAuthor: boolean;
  reportId: string;
  version: number;
}>;

type AdminCommentRow = CommentRow &
  Readonly<{
    company_name: string;
    open_flags: { id: string; reason: CommentFlagReason }[];
    role_title: string;
    slug: string;
  }>;

export type AdminIntelligenceComment = IntelligenceComment &
  Readonly<{
    companyName: string;
    openFlags: readonly Readonly<{ id: string; reason: CommentFlagReason }>[];
    roleTitle: string;
    slug: string;
  }>;

const timestamp = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const mapComment = (row: CommentRow, owner: string): IntelligenceComment => ({
  body: row.body,
  createdAt: timestamp(row.created_at),
  id: row.id,
  mine: row.owner_user_id === owner,
  moderationState: row.moderation_state,
  parentCommentId: row.parent_comment_id,
  reportAuthor: row.report_author,
  reportId: row.report_id,
  version: row.version,
});

export async function hasCurrentCommunityAgreement(db: TransactionSql, owner: string) {
  const rows = await db<{ accepted: boolean }[]>`select exists(
    select 1 from app.member_community_agreement
    where owner_user_id=${owner}::uuid and terms_version=${communityTermsVersion}
  ) accepted`;
  return rows[0]?.accepted ?? false;
}

export async function acceptCurrentCommunityAgreement(db: TransactionSql, owner: string) {
  if (await hasCurrentCommunityAgreement(db, owner)) return { outcome: "unchanged" } as const;
  await db`insert into app.member_community_agreement(owner_user_id,terms_version)
    values(${owner}::uuid,${communityTermsVersion})
    on conflict(owner_user_id) do update set terms_version=excluded.terms_version,
      accepted_at=clock_timestamp(),updated_at=clock_timestamp()`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'community.agreement_accepted','member_community_agreement',${owner}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function listReportDiscussion(db: TransactionSql, owner: string, reportId: string) {
  const rows = await db<CommentRow[]>`select c.id,c.report_id,c.owner_user_id,c.parent_comment_id,
    c.body,c.moderation_state,c.version,c.created_at,
    (c.owner_user_id=r.owner_user_id) report_author
    from app.recruitment_intelligence_comment c
    join app.recruitment_intelligence_report r on r.id=c.report_id
    where c.report_id=${reportId}::uuid
      and (c.moderation_state='published' or c.owner_user_id=${owner}::uuid)
    order by c.created_at,c.id`;
  return rows.map((row) => mapComment(row, owner));
}

export async function submitComment(db: TransactionSql, owner: string, value: CommentInput) {
  await db`select pg_advisory_xact_lock(hashtextextended(${owner},0))`;
  const accepted = await hasCurrentCommunityAgreement(db, owner);
  if (!accepted && !value.agreementConfirmed) return { outcome: "agreement_required" } as const;
  if (!accepted) await acceptCurrentCommunityAgreement(db, owner);
  const counts = await db<{ day_count: number; hour_count: number }[]>`select
    count(*) filter(where created_at>=clock_timestamp()-interval '1 hour')::int hour_count,
    count(*) filter(where created_at>=clock_timestamp()-interval '1 day')::int day_count
    from app.recruitment_intelligence_comment where owner_user_id=${owner}::uuid`;
  if ((counts[0]?.hour_count ?? 0) >= 5 || (counts[0]?.day_count ?? 0) >= 20)
    return { outcome: "rate_limited" } as const;
  const rows = await db<CommentRow[]>`insert into app.recruitment_intelligence_comment(
    report_id,owner_user_id,parent_comment_id,body
  ) values(${value.reportId}::uuid,${owner}::uuid,${value.parentCommentId}::uuid,${value.body})
  returning id,report_id,owner_user_id,parent_comment_id,body,moderation_state,version,created_at,false report_author`;
  const comment = rows[0]!;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'intelligence.comment_submitted','recruitment_intelligence_comment',${comment.id}::uuid,'{}'::jsonb)`;
  return { item: mapComment(comment, owner), outcome: "submitted" } as const;
}

export async function flagComment(
  db: TransactionSql,
  owner: string,
  commentId: string,
  reason: CommentFlagReason,
) {
  const rows = await db<{ id: string }[]>`insert into app.recruitment_intelligence_comment_flag(
    comment_id,owner_user_id,reason
  ) values(${commentId}::uuid,${owner}::uuid,${reason})
  on conflict(comment_id,owner_user_id) do nothing returning id`;
  if (!rows[0]) return { outcome: "unchanged" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'intelligence.comment_flagged','recruitment_intelligence_comment_flag',${rows[0].id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function listCommentsForAdmin(db: TransactionSql, administrator: string) {
  const rows = await db<AdminCommentRow[]>`select c.id,c.report_id,c.owner_user_id,
    c.parent_comment_id,c.body,c.moderation_state,c.version,c.created_at,
    (c.owner_user_id=r.owner_user_id) report_author,r.company_name,r.role_title,r.slug,
    coalesce(jsonb_agg(jsonb_build_object('id',f.id,'reason',f.reason))
      filter(where f.id is not null),'[]'::jsonb) open_flags
    from app.recruitment_intelligence_comment c
    join app.recruitment_intelligence_report r on r.id=c.report_id
    left join app.recruitment_intelligence_comment_flag f
      on f.comment_id=c.id and f.resolution is null
    where c.moderation_state='pending' or f.id is not null
    group by c.id,r.id
    order by case when c.moderation_state='pending' then 0 else 1 end,c.created_at,c.id`;
  return rows.map((row) => ({
    ...mapComment(row, administrator),
    companyName: row.company_name,
    openFlags: row.open_flags,
    roleTitle: row.role_title,
    slug: row.slug,
  }));
}

export async function moderateComment(
  db: TransactionSql,
  administrator: string,
  commentId: string,
  expectedVersion: number,
  state: "published" | "rejected" | "removed",
) {
  const rows = await db<{ id: string }[]>`update app.recruitment_intelligence_comment set
    moderation_state=${state},moderated_by_user_id=${administrator}::uuid,
    moderated_at=clock_timestamp(),moderator_note=null
    where id=${commentId}::uuid and version=${expectedVersion} returning id`;
  if (!rows[0]) return { outcome: "conflict" } as const;
  if (state === "removed") {
    await db`update app.recruitment_intelligence_comment set
      moderation_state='removed',moderated_by_user_id=${administrator}::uuid,
      moderated_at=clock_timestamp(),moderator_note=null
      where parent_comment_id=${commentId}::uuid and moderation_state<>'removed'`;
    await db`update app.recruitment_intelligence_comment_flag set resolution='content_removed',
      resolved_by_user_id=${administrator}::uuid,resolved_at=clock_timestamp()
      where resolution is null and comment_id in (
        select id from app.recruitment_intelligence_comment
        where id=${commentId}::uuid or parent_comment_id=${commentId}::uuid
      )`;
  }
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,${`intelligence.comment_${state}`},
      'recruitment_intelligence_comment',${commentId}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function dismissCommentFlag(
  db: TransactionSql,
  administrator: string,
  flagId: string,
) {
  const rows = await db<{ id: string }[]>`update app.recruitment_intelligence_comment_flag set
    resolution='dismissed',resolved_by_user_id=${administrator}::uuid,resolved_at=clock_timestamp()
    where id=${flagId}::uuid and resolution is null returning id`;
  if (!rows[0]) return { outcome: "unchanged" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'intelligence.comment_flag_dismissed',
      'recruitment_intelligence_comment_flag',${flagId}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}
