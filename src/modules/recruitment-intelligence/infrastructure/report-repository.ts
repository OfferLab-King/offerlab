import type { TransactionSql } from "postgres";
import type { ReportValues } from "../domain/report";

type Row = Readonly<{
  approximate_date: Date | string;
  assessed_skills: string[];
  format_summary: string;
  id: string;
  industry: string | null;
  moderation_confidence: string | null;
  moderation_state: "pending" | "published" | "rejected";
  opportunity_type: string | null;
  owner_user_id: string;
  recruitment_cycle: string;
  recruitment_stage: string;
  reflection: string;
  themes: string;
  version: number;
}>;
export type IntelligenceReport = Readonly<{
  approximateDate: string;
  assessedSkills: readonly string[];
  formatSummary: string;
  id: string;
  industry: string | null;
  mine: boolean;
  moderationConfidence: string | null;
  moderationState: "pending" | "published" | "rejected";
  opportunityType: string | null;
  recruitmentCycle: string;
  recruitmentStage: string;
  reflection: string;
  themes: string;
  version: number;
}>;

const map = (row: Row, owner: string): IntelligenceReport => ({
  approximateDate:
    row.approximate_date instanceof Date
      ? row.approximate_date.toISOString().slice(0, 10)
      : row.approximate_date,
  assessedSkills: row.assessed_skills,
  formatSummary: row.format_summary,
  id: row.id,
  industry: row.industry,
  mine: row.owner_user_id === owner,
  moderationConfidence: row.moderation_confidence,
  moderationState: row.moderation_state,
  opportunityType: row.opportunity_type,
  recruitmentCycle: row.recruitment_cycle,
  recruitmentStage: row.recruitment_stage,
  reflection: row.reflection,
  themes: row.themes,
  version: row.version,
});

export async function listReports(db: TransactionSql, owner: string) {
  const rows = await db<Row[]>`select * from app.recruitment_intelligence_report
    where moderation_state='published' or owner_user_id=${owner}::uuid
    order by case moderation_state when 'published' then 0 else 1 end, approximate_date desc, id`;
  return rows.map((row) => map(row, owner));
}

export async function listReportsForAdmin(db: TransactionSql, owner: string) {
  const rows = await db<Row[]>`select * from app.recruitment_intelligence_report
    order by case moderation_state when 'pending' then 0 when 'published' then 1 else 2 end, created_at, id`;
  return rows.map((row) => map(row, owner));
}

export async function createReport(db: TransactionSql, owner: string, value: ReportValues) {
  const rows = await db<Row[]>`insert into app.recruitment_intelligence_report(
    owner_user_id,recruitment_cycle,approximate_date,recruitment_stage,opportunity_type,industry,
    format_summary,themes,assessed_skills,reflection
  ) values(
    ${owner}::uuid,${value.recruitmentCycle},${value.approximateDate}::date,
    ${value.recruitmentStage},${value.opportunityType},${value.industry},${value.formatSummary},
    ${value.themes},${value.assessedSkills},${value.reflection}
  ) returning *`;
  const report = rows[0]!;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'intelligence.submitted','recruitment_intelligence_report',${report.id}::uuid,'{}'::jsonb)`;
  return map(report, owner);
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
