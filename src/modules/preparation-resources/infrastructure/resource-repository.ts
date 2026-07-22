import type { TransactionSql } from "postgres";
import { LIBRARY_PAGE_SIZE } from "../domain/resource";

export type ResourceRecord = Readonly<{
  accessLevel: "public" | "member";
  categoryName: string;
  completedAt: Date | null;
  estimatedMinutes: number | null;
  id: string;
  markdownBody: string;
  links: readonly Readonly<{
    label: string;
    type: "download" | "external" | "template_copy";
    url: string;
  }>[];
  publicationState: "draft" | "published" | "archived";
  resourceKey: string;
  resourceType: "guide" | "checklist" | "template" | "video" | "exercise" | "article";
  relatedResources: readonly Readonly<{
    accessLevel: "public" | "member";
    slug: string;
    title: string;
  }>[];
  savedAt: Date | null;
  shortDescription: string;
  slug: string;
  stages: readonly string[];
  title: string;
  version: number;
  youtubeVideoId: string | null;
}>;

type Row = Omit<
  ResourceRecord,
  | "accessLevel"
  | "categoryName"
  | "completedAt"
  | "estimatedMinutes"
  | "markdownBody"
  | "links"
  | "publicationState"
  | "resourceKey"
  | "resourceType"
  | "relatedResources"
  | "savedAt"
  | "shortDescription"
  | "youtubeVideoId"
> & {
  access_level: ResourceRecord["accessLevel"];
  category_name: string;
  completed_at: Date | null;
  estimated_minutes: number | null;
  markdown_body: string;
  links: ResourceRecord["links"];
  publication_state: ResourceRecord["publicationState"];
  resource_key: string;
  resource_type: ResourceRecord["resourceType"];
  related_resources: ResourceRecord["relatedResources"];
  saved_at: Date | null;
  short_description: string;
  youtube_video_id: string | null;
};

function map(row: Row): ResourceRecord {
  return {
    accessLevel: row.access_level,
    categoryName: row.category_name,
    completedAt: row.completed_at,
    estimatedMinutes: row.estimated_minutes,
    id: row.id,
    markdownBody: row.markdown_body,
    links: row.links,
    publicationState: row.publication_state,
    resourceKey: row.resource_key,
    resourceType: row.resource_type,
    relatedResources: row.related_resources,
    savedAt: row.saved_at,
    shortDescription: row.short_description,
    slug: row.slug,
    stages: row.stages,
    title: row.title,
    version: row.version,
    youtubeVideoId: row.youtube_video_id,
  };
}

export type LibraryFilters = Readonly<{
  category?: string;
  completed?: "complete" | "incomplete";
  page: number;
  opportunityType?: string;
  query: string;
  queryInvalid: boolean;
  saved: boolean;
  stage?: string;
  tag?: string;
  type?: string;
}>;

export async function listPublishedResources(
  database: TransactionSql,
  ownerId: string | null,
  filters: LibraryFilters,
  limit = LIBRARY_PAGE_SIZE,
): Promise<readonly ResourceRecord[]> {
  const offset = (filters.page - 1) * LIBRARY_PAGE_SIZE;
  const rows = await database<Row[]>`
    select r.id,r.resource_key,r.slug,r.title,r.short_description,r.resource_type,r.access_level,r.publication_state,
      r.markdown_body,r.estimated_minutes,r.youtube_video_id,r.version,c.name category_name,
      coalesce((select jsonb_agg(jsonb_build_object('type',l.link_type,'label',l.label,'url',l.url) order by l.position) from app.preparation_resource_link l where l.resource_id=r.id),'[]') links,
      coalesce((select jsonb_agg(jsonb_build_object('accessLevel',rr.access_level,'slug',rr.slug,'title',rr.title) order by rel.position) from app.preparation_resource_relation rel join app.preparation_resource rr on rr.id=rel.related_resource_id join app.content_category rc on rc.id=rr.primary_category_id and rc.archived_at is null where rel.resource_id=r.id and rr.publication_state='published' and (${ownerId}::uuid is not null or rr.access_level='public')),'[]') related_resources,
      coalesce(array_agg(distinct rs.stage) filter(where rs.stage is not null),'{}') stages,
      ms.saved_at,ms.completed_at
    from app.preparation_resource r join app.content_category c on c.id=r.primary_category_id and c.archived_at is null
    left join app.preparation_resource_stage rs on rs.resource_id=r.id
    left join app.member_resource_state ms on ms.resource_id=r.id and ms.owner_user_id=${ownerId}::uuid
    where r.publication_state='published'
      and (${ownerId}::uuid is not null or r.access_level='public')
      and ${!filters.queryInvalid}
      and (${filters.query}='' or r.search_document @@ websearch_to_tsquery('english',${filters.query}))
      and (${filters.category ?? null}::text is null or c.slug=${filters.category ?? null})
      and (${filters.type ?? null}::text is null or r.resource_type=${filters.type ?? null})
      and (${filters.stage ?? null}::text is null or exists(select 1 from app.preparation_resource_stage x where x.resource_id=r.id and x.stage=${filters.stage ?? null}))
      and (${filters.opportunityType ?? null}::text is null or exists(select 1 from app.preparation_resource_opportunity_type x where x.resource_id=r.id and x.opportunity_type=${filters.opportunityType ?? null}))
      and (${filters.tag ?? null}::text is null or exists(select 1 from app.preparation_resource_tag rt join app.content_tag t on t.id=rt.tag_id where rt.resource_id=r.id and t.slug=${filters.tag ?? null} and t.archived_at is null))
      and (${filters.saved}=false or ms.saved_at is not null)
      and (${filters.completed ?? null}::text is null or (${filters.completed ?? null}='complete' and ms.completed_at is not null) or (${filters.completed ?? null}='incomplete' and ms.completed_at is null))
    group by r.id,c.name,ms.saved_at,ms.completed_at
    order by r.title asc,r.id asc limit ${limit} offset ${offset}`;
  return rows.map(map);
}

export async function listLibraryTaxonomy(database: TransactionSql) {
  const [categories, tags] = await Promise.all([
    database<
      { name: string; slug: string }[]
    >`select name,slug from app.content_category where archived_at is null order by name,id`,
    database<
      { name: string; slug: string }[]
    >`select name,slug from app.content_tag where archived_at is null and exists(select 1 from app.preparation_resource_tag rt join app.preparation_resource r on r.id=rt.resource_id where rt.tag_id=app.content_tag.id and r.publication_state='published') order by name,id`,
  ]);
  return { categories, tags } as const;
}

export async function findPublishedResource(
  database: TransactionSql,
  slug: string,
  ownerId: string | null,
): Promise<ResourceRecord | null> {
  const rows = await database<Row[]>`
    select r.id,r.resource_key,r.slug,r.title,r.short_description,r.resource_type,r.access_level,r.publication_state,
      r.markdown_body,r.estimated_minutes,r.youtube_video_id,r.version,c.name category_name,
      coalesce((select jsonb_agg(jsonb_build_object('type',l.link_type,'label',l.label,'url',l.url) order by l.position) from app.preparation_resource_link l where l.resource_id=r.id),'[]') links,
      coalesce((select jsonb_agg(jsonb_build_object('accessLevel',rr.access_level,'slug',rr.slug,'title',rr.title) order by rel.position) from app.preparation_resource_relation rel join app.preparation_resource rr on rr.id=rel.related_resource_id join app.content_category rc on rc.id=rr.primary_category_id and rc.archived_at is null where rel.resource_id=r.id and rr.publication_state='published' and (${ownerId}::uuid is not null or rr.access_level='public')),'[]') related_resources,
      coalesce(array_agg(distinct rs.stage) filter(where rs.stage is not null),'{}') stages,ms.saved_at,ms.completed_at
    from app.preparation_resource r join app.content_category c on c.id=r.primary_category_id and c.archived_at is null
    left join app.preparation_resource_stage rs on rs.resource_id=r.id
    left join app.member_resource_state ms on ms.resource_id=r.id and ms.owner_user_id=${ownerId}::uuid
    where r.slug=${slug} and r.publication_state='published' and (${ownerId}::uuid is not null or r.access_level='public')
    group by r.id,c.name,ms.saved_at,ms.completed_at limit 1`;
  return rows[0] ? map(rows[0]) : null;
}

export async function mutateMemberResourceState(
  database: TransactionSql,
  ownerId: string,
  resourceId: string,
  action: "save" | "unsave" | "complete" | "incomplete",
) {
  const rows = await database<
    { id: string; saved_at: Date | null; completed_at: Date | null }[]
  >`select id,saved_at,completed_at from app.member_resource_state where owner_user_id=${ownerId}::uuid and resource_id=${resourceId}::uuid for update`;
  const current = rows[0];
  const isSave = action === "save",
    isComplete = action === "complete";
  if (
    (isSave && current?.saved_at) ||
    (action === "unsave" && !current?.saved_at) ||
    (isComplete && current?.completed_at) ||
    (action === "incomplete" && !current?.completed_at)
  )
    return { outcome: "unchanged" } as const;
  const changed = await database<
    { id: string }[]
  >`insert into app.member_resource_state(owner_user_id,resource_id,saved_at,completed_at)
    values(${ownerId}::uuid,${resourceId}::uuid,${isSave ? new Date() : null},${isComplete ? new Date() : null})
    on conflict(owner_user_id,resource_id) do update set
      saved_at=case when ${action} in ('save','unsave') then case when ${isSave} then clock_timestamp() else null end else app.member_resource_state.saved_at end,
      completed_at=case when ${action} in ('complete','incomplete') then case when ${isComplete} then clock_timestamp() else null end else app.member_resource_state.completed_at end returning id`;
  const outcomes = {
    save: "saved",
    unsave: "unsaved",
    complete: "completed",
    incomplete: "marked_incomplete",
  } as const;
  const audit = {
    save: "resource.saved",
    unsave: "resource.unsaved",
    complete: "resource.completed",
    incomplete: "resource.marked_incomplete",
  } as const;
  await database`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${ownerId}::uuid,${audit[action]},'member_resource_state',${changed[0]!.id}::uuid,'{}'::jsonb)`;
  return { outcome: outcomes[action] } as const;
}
