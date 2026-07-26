import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { createReportSlug, type ReportFilters, type ReportValues } from "../domain/report";

type Row = Readonly<{
  approximate_date: Date | string;
  assessed_skills: string[];
  company_name: string;
  comment_count?: number | string;
  format_summary: string;
  id: string;
  industry: string | null;
  location: string | null;
  moderated_at: Date | string | null;
  moderation_confidence: string | null;
  moderation_state: "pending" | "published" | "rejected";
  opportunity_type: string | null;
  outcome: string | null;
  owner_user_id: string;
  preparation_advice: string;
  recruitment_cycle: string;
  recruitment_stage: string;
  reflection: string;
  role_title: string;
  slug: string;
  source_kind: "member" | "coach_curated";
  themes: string;
  version: number;
}>;

export type IntelligenceReport = Readonly<{
  approximateDate: string;
  assessedSkills: readonly string[];
  companyName: string;
  commentCount: number;
  formatSummary: string;
  id: string;
  industry: string | null;
  location: string | null;
  mine: boolean;
  moderatedAt: string | null;
  moderationConfidence: string | null;
  moderationState: "pending" | "published" | "rejected";
  opportunityType: string | null;
  outcome: string | null;
  preparationAdvice: string;
  recruitmentCycle: string;
  recruitmentStage: string;
  reflection: string;
  roleTitle: string;
  slug: string;
  sourceKind: "member" | "coach_curated";
  themes: string;
  version: number;
}>;

const date = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;
const timestamp = (value: Date | string | null) =>
  value instanceof Date ? value.toISOString() : value;

const map = (row: Row, owner: string | null): IntelligenceReport => ({
  approximateDate: date(row.approximate_date),
  assessedSkills: row.assessed_skills,
  companyName: row.company_name,
  commentCount: Number(row.comment_count ?? 0),
  formatSummary: row.format_summary,
  id: row.id,
  industry: row.industry,
  location: row.location,
  mine: row.owner_user_id === owner,
  moderatedAt: timestamp(row.moderated_at),
  moderationConfidence: row.moderation_confidence,
  moderationState: row.moderation_state,
  opportunityType: row.opportunity_type,
  outcome: row.outcome,
  preparationAdvice: row.preparation_advice,
  recruitmentCycle: row.recruitment_cycle,
  recruitmentStage: row.recruitment_stage,
  reflection: row.reflection,
  roleTitle: row.role_title,
  slug: row.slug,
  sourceKind: row.source_kind,
  themes: row.themes,
  version: row.version,
});

export async function listPublishedReports(
  db: TransactionSql,
  owner: string | null,
  filters: ReportFilters,
) {
  const rows = await db<Row[]>`select r.*,(select count(*)::int
      from app.recruitment_intelligence_comment c
      where c.report_id=r.id and c.moderation_state='published') comment_count
    from app.recruitment_intelligence_report r
    where r.moderation_state='published'
      and (${filters.query}='' or r.search_document @@ websearch_to_tsquery('english',${filters.query}))
      and (${filters.stage ?? null}::text is null or r.recruitment_stage=${filters.stage ?? null})
      and (${filters.industry ?? null}::text is null or r.industry=${filters.industry ?? null})
      and (${filters.cycle ?? null}::text is null or r.recruitment_cycle=${filters.cycle ?? null})
    order by r.approximate_date desc,r.company_name,r.role_title,r.id limit 100`;
  return rows.map((row) => map(row, owner));
}

export async function listOwnerReports(db: TransactionSql, owner: string) {
  const rows = await db<Row[]>`select * from app.recruitment_intelligence_report
    where owner_user_id=${owner}::uuid order by created_at desc,id`;
  return rows.map((row) => map(row, owner));
}

export async function findReportBySlug(db: TransactionSql, slug: string, owner: string | null) {
  const rows = await db<Row[]>`select r.*,(select count(*)::int
      from app.recruitment_intelligence_comment c
      where c.report_id=r.id and c.moderation_state='published') comment_count
    from app.recruitment_intelligence_report r
    where r.slug=${slug} and (r.moderation_state='published' or r.owner_user_id=${owner}::uuid) limit 1`;
  return rows[0] ? map(rows[0], owner) : null;
}

export async function listReportsForAdmin(db: TransactionSql, owner: string) {
  const rows = await db<Row[]>`select * from app.recruitment_intelligence_report
    order by case moderation_state when 'pending' then 0 when 'published' then 1 else 2 end,
    updated_at desc,id`;
  return rows.map((row) => map(row, owner));
}

export async function findReportForAdmin(db: TransactionSql, owner: string, id: string) {
  const rows = await db<
    Row[]
  >`select * from app.recruitment_intelligence_report where id=${id}::uuid`;
  return rows[0] ? map(rows[0], owner) : null;
}

export async function createReport(db: TransactionSql, owner: string, value: ReportValues) {
  const id = randomUUID();
  const slug = createReportSlug(value.companyName, value.recruitmentStage, id);
  const rows = await db<Row[]>`insert into app.recruitment_intelligence_report(
    id,owner_user_id,slug,company_name,role_title,location,recruitment_cycle,approximate_date,
    recruitment_stage,opportunity_type,industry,format_summary,themes,assessed_skills,reflection,
    preparation_advice,outcome,source_kind,confidentiality_confirmed_at
  ) values(
    ${id}::uuid,${owner}::uuid,${slug},${value.companyName},${value.roleTitle},${value.location},
    ${value.recruitmentCycle},${value.approximateDate}::date,${value.recruitmentStage},
    ${value.opportunityType},${value.industry},${value.formatSummary},${value.themes},
    ${value.assessedSkills},${value.reflection},${value.preparationAdvice},${value.outcome},
    ${value.sourceKind},clock_timestamp()
  ) returning *`;
  const report = rows[0]!;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'intelligence.submitted','recruitment_intelligence_report',${report.id}::uuid,'{}'::jsonb)`;
  return map(report, owner);
}

export async function updateReportContent(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  value: ReportValues,
) {
  const rows = await db<Row[]>`update app.recruitment_intelligence_report set
    company_name=${value.companyName},role_title=${value.roleTitle},location=${value.location},
    recruitment_cycle=${value.recruitmentCycle},approximate_date=${value.approximateDate}::date,
    recruitment_stage=${value.recruitmentStage},opportunity_type=${value.opportunityType},
    industry=${value.industry},format_summary=${value.formatSummary},themes=${value.themes},
    assessed_skills=${value.assessedSkills},reflection=${value.reflection},
    preparation_advice=${value.preparationAdvice},outcome=${value.outcome}
    where id=${id}::uuid and version=${expectedVersion} returning *`;
  if (!rows[0]) return { outcome: "conflict" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'intelligence.updated','recruitment_intelligence_report',${id}::uuid,'{}'::jsonb)`;
  return { item: map(rows[0], administrator), outcome: "changed" } as const;
}

export async function moderateReport(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  state: "published" | "rejected",
  confidence: "low" | "medium" | "high",
) {
  const current = await db<
    Row[]
  >`select * from app.recruitment_intelligence_report where id=${id}::uuid`;
  if (!current[0]) return { outcome: "not_found" } as const;
  if (current[0].version !== expectedVersion) return { outcome: "conflict" } as const;
  if (current[0].moderation_state === state && current[0].moderation_confidence === confidence)
    return { outcome: "unchanged" } as const;
  await db`update app.recruitment_intelligence_report set moderation_state=${state},
    moderation_confidence=${confidence},moderated_by_user_id=${administrator}::uuid,moderated_at=now()
    where id=${id}::uuid and version=${expectedVersion}`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,${state === "published" ? "intelligence.published" : "intelligence.rejected"},
    'recruitment_intelligence_report',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}
