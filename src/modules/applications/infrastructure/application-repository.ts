import type { TransactionSql } from "postgres";

import { applicationValuesEqual, type ApplicationValues } from "../domain/application";

export type TrackedApplication = Readonly<
  ApplicationValues & {
    archivedAt: Date | null;
    createdAt: Date;
    id: string;
    updatedAt: Date;
    version: number;
  }
>;

type ApplicationRow = Readonly<{
  applied_date: string | null;
  application_deadline: string | null;
  archived_at: Date | null;
  company_id: string | null;
  company_name: string;
  created_at: Date;
  current_stage: ApplicationValues["stage"];
  industry: ApplicationValues["industry"];
  id: string;
  location: string | null;
  next_stage_deadline: string | null;
  notes: string | null;
  opportunity_type: ApplicationValues["opportunityType"];
  role_title: string;
  updated_at: Date;
  version: number;
}>;

function tracked(row: ApplicationRow): TrackedApplication {
  return {
    appliedDate: row.applied_date,
    applicationDeadline: row.application_deadline,
    archivedAt: row.archived_at,
    company: row.company_name,
    companyId: row.company_id,
    createdAt: row.created_at,
    id: row.id,
    industry: row.industry,
    location: row.location,
    nextStageDeadline: row.next_stage_deadline,
    notes: row.notes,
    opportunityType: row.opportunity_type,
    role: row.role_title,
    stage: row.current_stage,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

const columns = `
  id, company_id, company_name, role_title, opportunity_type, industry, current_stage, location,
  application_deadline::text, applied_date::text, next_stage_deadline::text, notes,
  archived_at, version, created_at, updated_at
`;

async function resolveCanonicalCompany(
  database: TransactionSql,
  values: ApplicationValues,
): Promise<ApplicationValues> {
  if (!values.companyId) return values;
  const selected = await database<{ id: string; name: string }[]>`
    select id, name
    from app.employer_public_profile
    where id = ${values.companyId}::uuid
    limit 1
  `;
  const company = selected[0];
  return company
    ? { ...values, company: company.name, companyId: company.id }
    : { ...values, companyId: null };
}

export type ApplicationMutationOutcome =
  "archived" | "created" | "restored" | "stage_changed" | "unchanged" | "updated";

export type ApplicationMutationResult =
  | Readonly<{ application: TrackedApplication; outcome: ApplicationMutationOutcome }>
  | Readonly<{ current: TrackedApplication; outcome: "conflict" }>
  | Readonly<{ outcome: "not_found" }>;

async function audit(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
  action: Exclude<ApplicationMutationOutcome, "unchanged">,
): Promise<void> {
  await database`
    insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      ${ownerId}::uuid, ${`application.${action}`}, 'application',
      ${applicationId}::uuid, '{}'::jsonb
    )
  `;
}

export async function listApplications(
  database: TransactionSql,
  ownerId: string,
  archived: boolean,
): Promise<readonly TrackedApplication[]> {
  const rows = await database.unsafe<ApplicationRow[]>(
    `select ${columns} from app.application
     where owner_user_id = $1::uuid and archived_at is ${archived ? "not " : ""}null
     order by coalesce(next_stage_deadline, application_deadline, '9999-12-31'::date), updated_at desc`,
    [ownerId],
  );
  return rows.map(tracked);
}

export async function findApplication(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
): Promise<TrackedApplication | null> {
  const rows = await database.unsafe<ApplicationRow[]>(
    `select ${columns} from app.application
     where id = $1::uuid and owner_user_id = $2::uuid`,
    [applicationId, ownerId],
  );
  return rows[0] ? tracked(rows[0]) : null;
}

export async function createApplication(
  database: TransactionSql,
  ownerId: string,
  values: ApplicationValues,
): Promise<ApplicationMutationResult> {
  const resolvedValues = await resolveCanonicalCompany(database, values);
  const rows = await database<ApplicationRow[]>`
    insert into app.application (
      owner_user_id, company_id, company_name, role_title, opportunity_type, industry, current_stage, location,
      application_deadline, applied_date, next_stage_deadline, notes
    ) values (
      ${ownerId}::uuid, ${resolvedValues.companyId ?? null}::uuid, ${resolvedValues.company}, ${resolvedValues.role}, ${resolvedValues.opportunityType},
      ${resolvedValues.industry}, ${resolvedValues.stage}, ${resolvedValues.location}, ${resolvedValues.applicationDeadline},
      ${resolvedValues.appliedDate}, ${resolvedValues.nextStageDeadline}, ${resolvedValues.notes}
    )
    returning id, company_id, company_name, role_title, opportunity_type, industry, current_stage, location,
      application_deadline::text, applied_date::text, next_stage_deadline::text, notes,
      archived_at, version, created_at, updated_at
  `;
  const created = rows[0];
  if (!created) throw new Error("application_create_failed");
  await audit(database, ownerId, created.id, "created");
  return { application: tracked(created), outcome: "created" };
}

function values(application: TrackedApplication): ApplicationValues {
  return {
    appliedDate: application.appliedDate,
    applicationDeadline: application.applicationDeadline,
    company: application.company,
    companyId: application.companyId,
    industry: application.industry,
    location: application.location,
    nextStageDeadline: application.nextStageDeadline,
    notes: application.notes,
    opportunityType: application.opportunityType,
    role: application.role,
    stage: application.stage,
  };
}

export async function lockApplication(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
): Promise<TrackedApplication | null> {
  const rows = await database.unsafe<ApplicationRow[]>(
    `select ${columns} from app.application
     where id = $1::uuid and owner_user_id = $2::uuid for update`,
    [applicationId, ownerId],
  );
  return rows[0] ? tracked(rows[0]) : null;
}

export async function updateApplication(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
  expectedVersion: number,
  nextValues: ApplicationValues,
): Promise<ApplicationMutationResult> {
  const current = await lockApplication(database, ownerId, applicationId);
  if (!current) return { outcome: "not_found" };
  if (current.archivedAt) return { outcome: "not_found" };
  if (current.version !== expectedVersion) return { current, outcome: "conflict" };
  const resolvedValues = await resolveCanonicalCompany(database, nextValues);
  if (applicationValuesEqual(values(current), resolvedValues)) {
    return { application: current, outcome: "unchanged" };
  }
  const stageChanged = current.stage !== resolvedValues.stage;
  const outcome = stageChanged ? "stage_changed" : "updated";
  const rows = await database<ApplicationRow[]>`
    update app.application set
      company_id = ${resolvedValues.companyId ?? null}::uuid,
      company_name = ${resolvedValues.company}, role_title = ${resolvedValues.role},
      opportunity_type = ${resolvedValues.opportunityType}, industry = ${resolvedValues.industry},
      current_stage = ${resolvedValues.stage},
      location = ${resolvedValues.location}, application_deadline = ${resolvedValues.applicationDeadline},
      applied_date = ${resolvedValues.appliedDate}, next_stage_deadline = ${resolvedValues.nextStageDeadline},
      notes = ${resolvedValues.notes}
    where id = ${applicationId}::uuid and owner_user_id = ${ownerId}::uuid
      and version = ${expectedVersion}
    returning id, company_id, company_name, role_title, opportunity_type, industry, current_stage, location,
      application_deadline::text, applied_date::text, next_stage_deadline::text, notes,
      archived_at, version, created_at, updated_at
  `;
  const updated = rows[0];
  if (!updated) throw new Error("application_update_failed");
  await audit(database, ownerId, applicationId, outcome);
  return { application: tracked(updated), outcome };
}

export async function setApplicationArchived(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
  expectedVersion: number,
  archive: boolean,
): Promise<ApplicationMutationResult> {
  const current = await lockApplication(database, ownerId, applicationId);
  if (!current) return { outcome: "not_found" };
  if (current.version !== expectedVersion) return { current, outcome: "conflict" };
  if (Boolean(current.archivedAt) === archive) {
    return { application: current, outcome: "unchanged" };
  }
  const outcome = archive ? "archived" : "restored";
  const rows = await database<ApplicationRow[]>`
    update app.application set
      archived_at = case when ${archive} then changed.changed_at else null end,
      updated_at = changed.changed_at
    from (select clock_timestamp() as changed_at) as changed
    where id = ${applicationId}::uuid and owner_user_id = ${ownerId}::uuid
      and version = ${expectedVersion}
    returning id, company_name, role_title, opportunity_type, industry, current_stage, location,
      application_deadline::text, applied_date::text, next_stage_deadline::text, notes,
      archived_at, version, created_at, updated_at
  `;
  const updated = rows[0];
  if (!updated) throw new Error("application_archive_failed");
  await audit(database, ownerId, applicationId, outcome);
  return { application: tracked(updated), outcome };
}
