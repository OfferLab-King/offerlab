import type { TransactionSql } from "postgres";
import type {
  CareerDocumentKind,
  CareerDocumentVersionInput,
  CareerJobTargetInput,
} from "../domain/career-document";
import type { CareerReview } from "../domain/review";

export type CareerJobTarget = Readonly<{
  applyUrl: string | null;
  archivedAt: Date | null;
  companyId: string | null;
  companyName: string;
  description: string;
  employmentType: string | null;
  fetchedAt: Date | null;
  id: string;
  location: string | null;
  provider: "manual" | "jsearch";
  providerJobId: string | null;
  publishedAt: Date | null;
  roleTitle: string;
  sourcePublisher: string | null;
  sourceUrl: string | null;
  updatedAt: Date;
  version: number;
}>;

export type CareerDocumentVersion = Readonly<{
  contentText: string;
  createdAt: Date;
  id: string;
  jobDescription: string;
  label: string;
  origin: "upload" | "editor" | "copy";
  revision: number;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  sourceSizeBytes: number | null;
  targetCompany: string | null;
  targetJobId: string | null;
  targetRole: string | null;
}>;

export type CareerDocumentVersionSummary = Readonly<{
  createdAt: Date;
  id: string;
  label: string;
  revision: number;
}>;

export type CareerDocumentWorkspaceDocument = Readonly<{
  archivedAt: Date | null;
  id: string;
  kind: CareerDocumentKind;
  title: string;
}>;

export type CareerDocument = Readonly<{
  archivedAt: Date | null;
  id: string;
  kind: CareerDocumentKind;
  latestVersion: CareerDocumentVersion | null;
  title: string;
  updatedAt: Date;
  version: number;
  versionCount: number;
}>;

export type StoredCareerReview = CareerReview &
  Readonly<{
    createdAt: Date;
    id: string;
    modelRequested: boolean;
    promptVersion: number;
    providerId: string;
    providerMode: "fallback" | "local" | "model";
  }>;

type JobRow = Readonly<{
  apply_url: string | null;
  archived_at: Date | null;
  company_id: string | null;
  company_name: string;
  description: string;
  employment_type: string | null;
  fetched_at: Date | null;
  id: string;
  location: string | null;
  provider: CareerJobTarget["provider"];
  provider_job_id: string | null;
  published_at: Date | null;
  role_title: string;
  source_publisher: string | null;
  source_url: string | null;
  updated_at: Date;
  version: number;
}>;

type VersionRow = Readonly<{
  content_text: string;
  created_at: Date;
  id: string;
  job_description: string;
  label: string;
  origin: CareerDocumentVersion["origin"];
  revision: number;
  source_filename: string | null;
  source_mime_type: string | null;
  source_size_bytes: number | null;
  target_company: string | null;
  target_job_id: string | null;
  target_role: string | null;
}>;

type DocumentRow = Readonly<{
  archived_at: Date | null;
  id: string;
  kind: CareerDocumentKind;
  latest_content_text: string | null;
  latest_created_at: Date | null;
  latest_id: string | null;
  latest_job_description: string | null;
  latest_label: string | null;
  latest_origin: CareerDocumentVersion["origin"] | null;
  latest_revision: number | null;
  latest_source_filename: string | null;
  latest_source_mime_type: string | null;
  latest_source_size_bytes: number | null;
  latest_target_company: string | null;
  latest_target_job_id: string | null;
  latest_target_role: string | null;
  title: string;
  updated_at: Date;
  version: number;
  version_count: number;
}>;

type VersionSummaryRow = Readonly<{
  created_at: Date;
  id: string;
  label: string;
  revision: number;
}>;

const versionColumns = `
  id,revision,label,content_text,origin,source_filename,source_mime_type,source_size_bytes,
  target_job_id,target_role,target_company,job_description,created_at
`;

function version(row: VersionRow): CareerDocumentVersion {
  return {
    contentText: row.content_text,
    createdAt: row.created_at,
    id: row.id,
    jobDescription: row.job_description,
    label: row.label,
    origin: row.origin,
    revision: row.revision,
    sourceFilename: row.source_filename,
    sourceMimeType: row.source_mime_type,
    sourceSizeBytes: row.source_size_bytes,
    targetCompany: row.target_company,
    targetJobId: row.target_job_id,
    targetRole: row.target_role,
  };
}

function versionSummary(row: VersionSummaryRow): CareerDocumentVersionSummary {
  return {
    createdAt: row.created_at,
    id: row.id,
    label: row.label,
    revision: row.revision,
  };
}

function document(row: DocumentRow): CareerDocument {
  return {
    archivedAt: row.archived_at,
    id: row.id,
    kind: row.kind,
    latestVersion: row.latest_id
      ? version({
          content_text: row.latest_content_text!,
          created_at: row.latest_created_at!,
          id: row.latest_id,
          job_description: row.latest_job_description!,
          label: row.latest_label!,
          origin: row.latest_origin!,
          revision: row.latest_revision!,
          source_filename: row.latest_source_filename,
          source_mime_type: row.latest_source_mime_type,
          source_size_bytes: row.latest_source_size_bytes,
          target_company: row.latest_target_company,
          target_job_id: row.latest_target_job_id,
          target_role: row.latest_target_role,
        })
      : null,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
    versionCount: row.version_count,
  };
}

function job(row: JobRow): CareerJobTarget {
  return {
    applyUrl: row.apply_url,
    archivedAt: row.archived_at,
    companyId: row.company_id,
    companyName: row.company_name,
    description: row.description,
    employmentType: row.employment_type,
    fetchedAt: row.fetched_at,
    id: row.id,
    location: row.location,
    provider: row.provider,
    providerJobId: row.provider_job_id,
    publishedAt: row.published_at,
    roleTitle: row.role_title,
    sourcePublisher: row.source_publisher,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

async function audit(
  database: TransactionSql,
  owner: string,
  entityType: string,
  entityId: string,
  action: string,
) {
  await database`
    insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,${action},${entityType},${entityId}::uuid,'{}'::jsonb)
  `;
}

const documentQuery = `
  select d.id,d.kind,d.title,d.archived_at,d.version,
    greatest(d.updated_at,latest.created_at) updated_at,
    coalesce(count(v.id),0)::int version_count,
    latest.id latest_id,latest.revision latest_revision,latest.label latest_label,
    latest.content_text latest_content_text,latest.origin latest_origin,
    latest.source_filename latest_source_filename,latest.source_mime_type latest_source_mime_type,
    latest.source_size_bytes latest_source_size_bytes,latest.target_job_id latest_target_job_id,
    latest.target_role latest_target_role,latest.target_company latest_target_company,
    latest.job_description latest_job_description,latest.created_at latest_created_at
  from app.career_document d
  left join app.career_document_version v
    on v.document_id=d.id and v.owner_user_id=d.owner_user_id
  left join lateral (
    select ${versionColumns} from app.career_document_version cv
    where cv.document_id=d.id and cv.owner_user_id=d.owner_user_id
    order by cv.revision desc limit 1
  ) latest on true
`;

export async function listCareerDocuments(
  database: TransactionSql,
  owner: string,
  kind: CareerDocumentKind,
  archived = false,
): Promise<readonly CareerDocument[]> {
  const rows = await database.unsafe<DocumentRow[]>(
    `${documentQuery}
     where d.owner_user_id=$1::uuid and d.kind=$2
       and d.archived_at is ${archived ? "not " : ""}null
     group by d.id,latest.id,latest.revision,latest.label,latest.content_text,latest.origin,
       latest.source_filename,latest.source_mime_type,latest.source_size_bytes,
       latest.target_job_id,latest.target_role,latest.target_company,latest.job_description,
       latest.created_at
     order by greatest(d.updated_at,latest.created_at) desc`,
    [owner, kind],
  );
  return rows.map(document);
}

export async function findCareerDocument(
  database: TransactionSql,
  owner: string,
  id: string,
): Promise<CareerDocument | null> {
  const rows = await database.unsafe<DocumentRow[]>(
    `${documentQuery}
     where d.owner_user_id=$1::uuid and d.id=$2::uuid
     group by d.id,latest.id,latest.revision,latest.label,latest.content_text,latest.origin,
       latest.source_filename,latest.source_mime_type,latest.source_size_bytes,
       latest.target_job_id,latest.target_role,latest.target_company,latest.job_description,
       latest.created_at`,
    [owner, id],
  );
  return rows[0] ? document(rows[0]) : null;
}

export async function findCareerDocumentWorkspaceDocument(
  database: TransactionSql,
  owner: string,
  id: string,
): Promise<CareerDocumentWorkspaceDocument | null> {
  const rows = await database.unsafe<
    Readonly<{
      archived_at: Date | null;
      id: string;
      kind: CareerDocumentKind;
      title: string;
    }>[]
  >(
    `select id,kind,title,archived_at from app.career_document
     where owner_user_id=$1::uuid and id=$2::uuid`,
    [owner, id],
  );
  const row = rows[0];
  return row
    ? {
        archivedAt: row.archived_at,
        id: row.id,
        kind: row.kind,
        title: row.title,
      }
    : null;
}

export async function listCareerDocumentVersionSummaries(
  database: TransactionSql,
  owner: string,
  documentId: string,
): Promise<readonly CareerDocumentVersionSummary[]> {
  const rows = await database.unsafe<VersionSummaryRow[]>(
    `select id,revision,label,created_at from app.career_document_version
     where owner_user_id=$1::uuid and document_id=$2::uuid order by revision desc`,
    [owner, documentId],
  );
  return rows.map(versionSummary);
}

export async function listCareerDocumentVersions(
  database: TransactionSql,
  owner: string,
  documentId: string,
): Promise<readonly CareerDocumentVersion[]> {
  const rows = await database.unsafe<VersionRow[]>(
    `select ${versionColumns} from app.career_document_version
     where owner_user_id=$1::uuid and document_id=$2::uuid order by revision desc`,
    [owner, documentId],
  );
  return rows.map(version);
}

export async function findCareerDocumentVersion(
  database: TransactionSql,
  owner: string,
  documentId: string,
  versionId: string,
): Promise<CareerDocumentVersion | null> {
  const rows = await database.unsafe<VersionRow[]>(
    `select ${versionColumns} from app.career_document_version
     where owner_user_id=$1::uuid and document_id=$2::uuid and id=$3::uuid`,
    [owner, documentId, versionId],
  );
  return rows[0] ? version(rows[0]) : null;
}

export async function createCareerDocument(
  database: TransactionSql,
  owner: string,
  kind: CareerDocumentKind,
  title: string,
  input: CareerDocumentVersionInput,
  source: Readonly<{
    filename: string;
    mimeType: string;
    sha256: string;
    sizeBytes: number;
  }>,
): Promise<CareerDocument> {
  const rows = await database<{ id: string }[]>`
    insert into app.career_document(owner_user_id,kind,title)
    values(${owner}::uuid,${kind},${title}) returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("career_document_create_failed");
  await audit(database, owner, "career_document", id, "career_document.created");
  await insertVersion(database, owner, id, 1, input, "upload", source);
  const created = await findCareerDocument(database, owner, id);
  if (!created) throw new Error("career_document_create_failed");
  return created;
}

async function resolveTarget(
  database: TransactionSql,
  owner: string,
  input: CareerDocumentVersionInput,
): Promise<CareerDocumentVersionInput> {
  if (!input.targetJobId) return input;
  const rows = await database<JobRow[]>`
    select * from app.career_job_target
    where owner_user_id=${owner}::uuid and id=${input.targetJobId}::uuid and archived_at is null
  `;
  const target = rows[0];
  if (!target) throw new Error("career_job_target_not_found");
  return {
    ...input,
    jobDescription: target.description,
    targetCompany: target.company_name,
    targetRole: target.role_title,
  };
}

async function insertVersion(
  database: TransactionSql,
  owner: string,
  documentId: string,
  revision: number,
  rawInput: CareerDocumentVersionInput,
  origin: CareerDocumentVersion["origin"],
  source: Readonly<{
    filename: string;
    mimeType: string;
    sha256: string;
    sizeBytes: number;
  }> | null,
) {
  const input = await resolveTarget(database, owner, rawInput);
  const rows = await database<{ id: string }[]>`
    insert into app.career_document_version(
      owner_user_id,document_id,revision,label,content_text,origin,source_filename,
      source_mime_type,source_size_bytes,source_sha256,target_job_id,target_role,
      target_company,job_description
    ) values(
      ${owner}::uuid,${documentId}::uuid,${revision},${input.label},${input.contentText},${origin},
      ${source?.filename ?? null},${source?.mimeType ?? null},${source?.sizeBytes ?? null},
      ${source?.sha256 ?? null},${input.targetJobId}::uuid,${input.targetRole},
      ${input.targetCompany},${input.jobDescription}
    ) returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("career_document_version_create_failed");
  await audit(database, owner, "career_document_version", id, "career_document.version_created");
  return id;
}

export async function createCareerDocumentVersion(
  database: TransactionSql,
  owner: string,
  documentId: string,
  input: CareerDocumentVersionInput,
  origin: "copy" | "editor" = "editor",
): Promise<CareerDocumentVersion | null> {
  const documents = await database<{ archived_at: Date | null }[]>`
    select archived_at from app.career_document
    where owner_user_id=${owner}::uuid and id=${documentId}::uuid for update
  `;
  if (!documents[0] || documents[0].archived_at) return null;
  const revisions = await database<{ revision: number }[]>`
    select coalesce(max(revision),0)::int revision from app.career_document_version
    where owner_user_id=${owner}::uuid and document_id=${documentId}::uuid
  `;
  const revision = (revisions[0]?.revision ?? 0) + 1;
  const versionId = await insertVersion(database, owner, documentId, revision, input, origin, null);
  return findCareerDocumentVersion(database, owner, documentId, versionId);
}

export async function listCareerJobTargets(
  database: TransactionSql,
  owner: string,
): Promise<readonly CareerJobTarget[]> {
  const rows = await database<JobRow[]>`
    select * from app.career_job_target
    where owner_user_id=${owner}::uuid and archived_at is null order by updated_at desc
  `;
  return rows.map(job);
}

async function resolveCareerJobTargetCompany(
  database: TransactionSql,
  input: CareerJobTargetInput,
): Promise<CareerJobTargetInput> {
  if (!input.companyId) return input;
  const selected = await database<{ id: string; name: string }[]>`
    select id, name
    from app.employer_public_profile
    where id = ${input.companyId}::uuid
    limit 1
  `;
  const company = selected[0];
  return company
    ? { ...input, companyId: company.id, companyName: company.name }
    : { ...input, companyId: null };
}

export async function saveCareerJobTarget(
  database: TransactionSql,
  owner: string,
  input: CareerJobTargetInput,
): Promise<CareerJobTarget> {
  const resolvedInput = await resolveCareerJobTargetCompany(database, input);
  const rows = await database<(JobRow & { inserted: boolean })[]>`
    insert into app.career_job_target(
      owner_user_id,provider,provider_job_id,source_publisher,role_title,company_name,company_id,
      location,employment_type,description,apply_url,source_url,published_at,fetched_at
    ) values(
      ${owner}::uuid,${resolvedInput.provider},${resolvedInput.providerJobId},${resolvedInput.sourcePublisher},
      ${resolvedInput.roleTitle},${resolvedInput.companyName},${resolvedInput.companyId ?? null}::uuid,${resolvedInput.location},${resolvedInput.employmentType},
      ${resolvedInput.description},${resolvedInput.applyUrl},${resolvedInput.sourceUrl},${resolvedInput.publishedAt},${resolvedInput.fetchedAt}
    )
    on conflict(owner_user_id,provider,provider_job_id) where provider_job_id is not null
    do update set
      source_publisher=excluded.source_publisher,role_title=excluded.role_title,
      company_name=excluded.company_name,company_id=excluded.company_id,location=excluded.location,
      employment_type=excluded.employment_type,description=excluded.description,
      apply_url=excluded.apply_url,source_url=excluded.source_url,
      published_at=excluded.published_at,fetched_at=excluded.fetched_at,archived_at=null
    returning *, (xmax=0) inserted
  `;
  const saved = rows[0];
  if (!saved) throw new Error("career_job_target_create_failed");
  await audit(
    database,
    owner,
    "career_job_target",
    saved.id,
    saved.inserted ? "career_job.created" : "career_job.updated",
  );
  return job(saved);
}

export async function saveCareerDocumentReview(
  database: TransactionSql,
  owner: string,
  documentVersionId: string,
  provider: Readonly<{
    id: string;
    inputTokens: number | null;
    latencyMs: number | null;
    mode: "fallback" | "local" | "model";
    modelRequested: boolean;
    noticeVersion: string | null;
    outputTokens: number | null;
    promptVersion: number;
  }>,
  review: CareerReview,
): Promise<StoredCareerReview> {
  const rows = await database<
    (Readonly<{
      created_at: Date;
      id: string;
      model_requested: boolean;
      prompt_version: number;
      provider_id: string;
      provider_mode: StoredCareerReview["providerMode"];
    }> & {
      document_checks: CareerReview["documentChecks"];
      matched_requirements: string[];
      missing_requirements: string[];
      priority_actions: CareerReview["priorityActions"];
      strengths: CareerReview["strengths"];
      suggested_content: string | null;
      summary: string;
    })[]
  >`
    insert into app.career_document_review(
      owner_user_id,document_version_id,provider_id,provider_mode,model_requested,
      provider_notice_version,prompt_version,summary,strengths,matched_requirements,
      missing_requirements,priority_actions,document_checks,suggested_content,
      input_tokens,output_tokens,latency_ms
    ) values(
      ${owner}::uuid,${documentVersionId}::uuid,${provider.id},${provider.mode},
      ${provider.modelRequested},${provider.noticeVersion},${provider.promptVersion},${review.summary},
      ${database.json(review.strengths)},${review.matchedRequirements as string[]},
      ${review.missingRequirements as string[]},${database.json(review.priorityActions)},
      ${database.json(review.documentChecks)},${review.suggestedContent},${provider.inputTokens},
      ${provider.outputTokens},${provider.latencyMs}
    ) returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("career_document_review_create_failed");
  await audit(database, owner, "career_document_review", row.id, "career_document.review_created");
  return {
    createdAt: row.created_at,
    documentChecks: row.document_checks,
    id: row.id,
    matchedRequirements: row.matched_requirements,
    missingRequirements: row.missing_requirements,
    modelRequested: row.model_requested,
    priorityActions: row.priority_actions,
    promptVersion: row.prompt_version,
    providerId: row.provider_id,
    providerMode: row.provider_mode,
    strengths: row.strengths,
    suggestedContent: row.suggested_content,
    summary: row.summary,
  };
}

export async function listCareerDocumentReviews(
  database: TransactionSql,
  owner: string,
  documentVersionId: string,
): Promise<readonly StoredCareerReview[]> {
  const rows = await database<
    Readonly<{
      created_at: Date;
      document_checks: CareerReview["documentChecks"];
      id: string;
      matched_requirements: string[];
      missing_requirements: string[];
      model_requested: boolean;
      priority_actions: CareerReview["priorityActions"];
      prompt_version: number;
      provider_id: string;
      provider_mode: StoredCareerReview["providerMode"];
      strengths: CareerReview["strengths"];
      suggested_content: string | null;
      summary: string;
    }>[]
  >`
    select * from app.career_document_review
    where owner_user_id=${owner}::uuid and document_version_id=${documentVersionId}::uuid
    order by created_at desc
  `;
  return rows.map((row) => ({
    createdAt: row.created_at,
    documentChecks: row.document_checks,
    id: row.id,
    matchedRequirements: row.matched_requirements,
    missingRequirements: row.missing_requirements,
    modelRequested: row.model_requested,
    priorityActions: row.priority_actions,
    promptVersion: row.prompt_version,
    providerId: row.provider_id,
    providerMode: row.provider_mode,
    strengths: row.strengths,
    suggestedContent: row.suggested_content,
    summary: row.summary,
  }));
}
