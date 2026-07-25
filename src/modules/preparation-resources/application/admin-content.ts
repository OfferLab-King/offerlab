import "server-only";
import { z } from "zod";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { recruitmentStages } from "../../applications/domain/application";
import { opportunityTypes } from "../../taxonomy/domain/opportunity-types";
import {
  controlledLinkSchema,
  normalizeSingleLine,
  parseYouTubeVideoId,
  resourceDraftSchema,
  slugSchema,
} from "../domain/resource";

export type TaxonomyRecord = Readonly<{
  archivedAt: Date | null;
  description?: string | null;
  id: string;
  name: string;
  slug: string;
  version: number;
}>;
export type CategoryOption = TaxonomyRecord;
export type ControlledLink = Readonly<{
  label: string;
  type: "download" | "external" | "template_copy";
  url: string;
}>;
export type AdminResource = Readonly<{
  accessLevel: "public" | "member";
  estimatedMinutes: number | null;
  firstPublishedAt: Date | null;
  id: string;
  links: readonly ControlledLink[];
  markdownBody: string;
  opportunityTypes: readonly string[];
  primaryCategoryId: string | null;
  publicationState: "draft" | "published" | "archived";
  relatedResourceIds: readonly string[];
  resourceType:
    "guide" | "checklist" | "template" | "video" | "exercise" | "article" | "coaching_case";
  shortDescription: string;
  slug: string;
  stages: readonly string[];
  tagIds: readonly string[];
  title: string;
  version: number;
  youtubeVideoId: string | null;
}>;

const resourceSelect = `select r.id,r.slug,r.title,r.publication_state "publicationState",r.access_level "accessLevel",
 r.resource_type "resourceType",r.version,r.short_description "shortDescription",r.markdown_body "markdownBody",
 r.primary_category_id "primaryCategoryId",r.estimated_minutes "estimatedMinutes",r.youtube_video_id "youtubeVideoId",
 r.first_published_at "firstPublishedAt",
 coalesce((select array_agg(x.tag_id::text order by x.tag_id) from app.preparation_resource_tag x where x.resource_id=r.id),'{}') "tagIds",
 coalesce((select array_agg(x.stage order by x.stage) from app.preparation_resource_stage x where x.resource_id=r.id),'{}') stages,
 coalesce((select array_agg(x.opportunity_type order by x.opportunity_type) from app.preparation_resource_opportunity_type x where x.resource_id=r.id),'{}') "opportunityTypes",
 coalesce((select array_agg(x.related_resource_id::text order by x.position) from app.preparation_resource_relation x where x.resource_id=r.id),'{}') "relatedResourceIds",
 coalesce((select jsonb_agg(jsonb_build_object('type',x.link_type,'label',x.label,'url',x.url) order by x.position) from app.preparation_resource_link x where x.resource_id=r.id),'[]') links
 from app.preparation_resource r`;

export const listAdminResources = (adminId: string) =>
  withApplicationUser(
    adminId,
    (db) =>
      db<AdminResource[]>`${db.unsafe(resourceSelect)} order by r.updated_at desc,r.id limit 100`,
  );
export const listCategories = (adminId: string, includeArchived = false) =>
  withApplicationUser(
    adminId,
    (db) => db<TaxonomyRecord[]>`
    select id,name,slug,description,archived_at "archivedAt",version from app.content_category
    where ${includeArchived} or archived_at is null order by archived_at nulls first,name,id`,
  );
export const listTags = (adminId: string, includeArchived = false) =>
  withApplicationUser(
    adminId,
    (db) => db<TaxonomyRecord[]>`
    select id,name,slug,archived_at "archivedAt",version from app.content_tag
    where ${includeArchived} or archived_at is null order by archived_at nulls first,name,id`,
  );
export const findAdminResource = (adminId: string, id: string) =>
  withApplicationUser(
    adminId,
    async (db) =>
      (await db<AdminResource[]>`${db.unsafe(resourceSelect)} where r.id=${id}::uuid`)[0] ?? null,
  );

const taxonomySchema = z
  .object({
    description: z.string().max(500).nullable().optional(),
    name: z.string().transform(normalizeSingleLine).pipe(z.string().min(1).max(80)),
    slug: slugSchema,
  })
  .strict();
export async function createTaxonomy(adminId: string, kind: "category" | "tag", input: unknown) {
  const parsed = taxonomySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  return withApplicationUser(adminId, async (db) => {
    const table = kind === "category" ? "content_category" : "content_tag";
    const duplicate = await db<
      { found: boolean }[]
    >`select exists(select 1 from ${db(`app.${table}`)} where lower(name)=lower(${parsed.data.name}) or slug=${parsed.data.slug}) found`;
    if (duplicate[0]?.found) return { ok: false as const, error: "duplicate" as const };
    const rows =
      kind === "category"
        ? await db<
            { id: string }[]
          >`insert into app.content_category(name,slug,description) values(${parsed.data.name},${parsed.data.slug},${parsed.data.description ?? null}) returning id`
        : await db<
            { id: string }[]
          >`insert into app.content_tag(name,slug,normalized_name) values(${parsed.data.name},${parsed.data.slug},${parsed.data.name.toLocaleLowerCase("en-GB")}) returning id`;
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,${`${kind === "category" ? "content_category" : "content_tag"}.created`},${kind === "category" ? "content_category" : "content_tag"},${rows[0]!.id}::uuid,'{}')`;
    return { ok: true as const, id: rows[0]!.id };
  });
}

export async function updateTaxonomy(
  adminId: string,
  kind: "category" | "tag",
  id: string,
  expectedVersion: number,
  input: unknown,
  intent: "save" | "archive" | "restore",
) {
  const parsed = taxonomySchema.pick({ name: true, description: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  return withApplicationUser(adminId, async (db) => {
    const current =
      kind === "category"
        ? (
            await db<
              TaxonomyRecord[]
            >`select id,name,slug,description,archived_at "archivedAt",version from app.content_category where id=${id}::uuid for update`
          )[0]
        : (
            await db<
              TaxonomyRecord[]
            >`select id,name,slug,archived_at "archivedAt",version from app.content_tag where id=${id}::uuid for update`
          )[0];
    if (!current) return { ok: false as const, error: "not_found" as const };
    if (current.version !== expectedVersion) return { ok: false as const, conflict: true as const };
    const archived =
      intent === "archive" ? true : intent === "restore" ? false : !!current.archivedAt;
    const description = kind === "category" ? (parsed.data.description ?? null) : null;
    if (
      current.name === parsed.data.name &&
      (current.description ?? null) === description &&
      !!current.archivedAt === archived
    )
      return { ok: true as const, outcome: "unchanged" as const, version: current.version };
    const duplicate = await db<
      { found: boolean }[]
    >`select exists(select 1 from ${db(`app.${kind === "category" ? "content_category" : "content_tag"}`)} where id<>${id}::uuid and lower(name)=lower(${parsed.data.name})) found`;
    if (duplicate[0]?.found) return { ok: false as const, error: "duplicate" as const };
    const rows =
      kind === "category"
        ? await db<
            { version: number }[]
          >`update app.content_category set name=${parsed.data.name},description=${description},archived_at=${archived ? new Date() : null} where id=${id}::uuid and version=${expectedVersion} returning version`
        : await db<
            { version: number }[]
          >`update app.content_tag set name=${parsed.data.name},normalized_name=${parsed.data.name.toLocaleLowerCase("en-GB")},archived_at=${archived ? new Date() : null} where id=${id}::uuid and version=${expectedVersion} returning version`;
    if (!rows[0]) return { ok: false as const, conflict: true as const };
    if (intent === "archive") {
      const affected =
        kind === "category"
          ? await db<
              { id: string }[]
            >`update app.preparation_resource set publication_state='draft',published_at=null where primary_category_id=${id}::uuid and publication_state='published' returning id`
          : await db<
              { id: string }[]
            >`update app.preparation_resource r set publication_state='draft',published_at=null where r.publication_state='published' and exists(select 1 from app.preparation_resource_tag x where x.resource_id=r.id and x.tag_id=${id}::uuid) returning r.id`;
      for (const resource of affected)
        await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,'content.unpublished','preparation_resource',${resource.id}::uuid,'{}')`;
    }
    const action = `content_${kind}.${intent === "save" ? "updated" : intent === "archive" ? "archived" : "restored"}`;
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,${action},${kind === "category" ? "content_category" : "content_tag"},${id}::uuid,'{}')`;
    return { ok: true as const, outcome: "changed" as const, version: rows[0].version };
  });
}

function strings(input: FormData, name: string): string[] {
  return input
    .getAll(name)
    .flatMap((item) => String(item).split(/\r?\n/u))
    .map((item) => item.trim())
    .filter(Boolean);
}
function value(input: FormData, name: string) {
  return String(input.get(name) ?? "");
}
function unique(values: readonly string[]) {
  return new Set(values).size === values.length;
}
function sameArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
const allowedFields = new Set([
  "accessLevel",
  "estimatedMinutes",
  "markdownBody",
  "opportunityTypes",
  "primaryCategoryId",
  "relatedResourceIds",
  "resourceType",
  "shortDescription",
  "slug",
  "stages",
  "tagIds",
  "title",
  "youtubeVideo",
  "controlledLinks",
  "expectedVersion",
  "intent",
]);
function draft(input: FormData) {
  if ([...input.keys()].some((key) => !allowedFields.has(key) && !key.startsWith("$ACTION_")))
    return { ok: false as const, error: "Unknown content field." };
  const video = value(input, "youtubeVideo");
  const parsedVideo = parseYouTubeVideoId(video);
  if (video && !parsedVideo)
    return { ok: false as const, error: "Enter a valid YouTube video ID or HTTPS YouTube URL." };
  const parsed = resourceDraftSchema.safeParse({
    accessLevel: value(input, "accessLevel"),
    estimatedMinutes: value(input, "estimatedMinutes")
      ? Number(value(input, "estimatedMinutes"))
      : null,
    markdownBody: value(input, "markdownBody"),
    primaryCategoryId: value(input, "primaryCategoryId") || null,
    resourceType: value(input, "resourceType"),
    shortDescription: value(input, "shortDescription"),
    slug: value(input, "slug"),
    title: value(input, "title"),
    youtubeVideo: video || null,
  });
  let links: unknown = [];
  try {
    links = JSON.parse(value(input, "controlledLinks") || "[]");
  } catch {
    return { ok: false as const, error: "Controlled links must be valid JSON." };
  }
  const parsedLinks = z.array(controlledLinkSchema).max(20).safeParse(links);
  const tagIds = strings(input, "tagIds"),
    stages = strings(input, "stages"),
    opportunities = strings(input, "opportunityTypes"),
    related = strings(input, "relatedResourceIds");
  if (
    !parsed.success ||
    !parsedLinks.success ||
    !unique(tagIds) ||
    !unique(stages) ||
    !unique(opportunities) ||
    !unique(related) ||
    !unique(parsedLinks.success ? parsedLinks.data.map((x) => `${x.type}\0${x.url}`) : []) ||
    related.length > 20 ||
    stages.some((x) => !(x in recruitmentStages)) ||
    opportunities.some((x) => !(x in opportunityTypes)) ||
    [...tagIds, ...related].some((x) => !z.string().uuid().safeParse(x).success)
  )
    return { ok: false as const, error: "Check content fields and associations." };
  return {
    ok: true as const,
    data: {
      ...parsed.data,
      youtubeVideoId: parsedVideo,
      links: parsedLinks.data,
      tagIds,
      stages,
      opportunityTypes: opportunities,
      relatedResourceIds: related,
    },
  };
}

export async function createDraft(adminId: string, input: FormData) {
  const parsed = draft(input);
  if (!parsed.ok) return parsed;
  return withApplicationUser(adminId, async (db) => {
    if (!(await validateAssociations(db, crypto.randomUUID(), parsed.data, false)))
      return { ok: false as const, error: "Content associations are unavailable or invalid." };
    const key = `content_${crypto.randomUUID().replaceAll("-", "")}`;
    const rows = await db<
      { id: string }[]
    >`insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,markdown_body,primary_category_id,estimated_minutes,youtube_video_id) values(${key},${parsed.data.slug},${parsed.data.title},${parsed.data.shortDescription},${parsed.data.resourceType},${parsed.data.accessLevel},${parsed.data.markdownBody},${parsed.data.primaryCategoryId}::uuid,${parsed.data.estimatedMinutes},${parsed.data.youtubeVideoId}) returning id`;
    await replaceAssociations(db, rows[0]!.id, parsed.data);
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,'content.created','preparation_resource',${rows[0]!.id}::uuid,'{}')`;
    return { ok: true as const, id: rows[0]!.id };
  });
}

type Db = Parameters<Parameters<typeof withApplicationUser>[1]>[0];
type DraftData = z.output<typeof resourceDraftSchema> &
  Readonly<{
    links: z.output<typeof controlledLinkSchema>[];
    opportunityTypes: string[];
    relatedResourceIds: string[];
    stages: string[];
    tagIds: string[];
    youtubeVideoId: string | null;
  }>;
async function validateAssociations(
  db: Db,
  id: string,
  data: DraftData,
  publishing: boolean,
  existingTagIds: readonly string[] = [],
) {
  if (data.relatedResourceIds.includes(id)) return false;
  const category = data.primaryCategoryId
    ? await db<
        { active: boolean }[]
      >`select archived_at is null active from app.content_category where id=${data.primaryCategoryId}::uuid`
    : [];
  if (data.primaryCategoryId && !category[0]) return false;
  if (publishing && (!category[0]?.active || !data.markdownBody)) return false;
  if (data.tagIds.length) {
    const tags = await db<
      { id: string; active: boolean }[]
    >`select id,archived_at is null active from app.content_tag where id=any(${data.tagIds}::uuid[])`;
    if (
      tags.length !== data.tagIds.length ||
      tags.some((x) => !x.active && (publishing || !existingTagIds.includes(x.id)))
    )
      return false;
  }
  if (data.relatedResourceIds.length) {
    const targets = await db<
      { id: string }[]
    >`select id from app.preparation_resource where id=any(${data.relatedResourceIds}::uuid[])`;
    if (targets.length !== data.relatedResourceIds.length) return false;
  }
  return true;
}
async function replaceAssociations(db: Db, id: string, data: DraftData) {
  await db`delete from app.preparation_resource_tag where resource_id=${id}::uuid`;
  for (const tag of data.tagIds)
    await db`insert into app.preparation_resource_tag(resource_id,tag_id) values(${id}::uuid,${tag}::uuid)`;
  await db`delete from app.preparation_resource_stage where resource_id=${id}::uuid`;
  for (const stage of data.stages)
    await db`insert into app.preparation_resource_stage(resource_id,stage) values(${id}::uuid,${stage})`;
  await db`delete from app.preparation_resource_opportunity_type where resource_id=${id}::uuid`;
  for (const type of data.opportunityTypes)
    await db`insert into app.preparation_resource_opportunity_type(resource_id,opportunity_type) values(${id}::uuid,${type})`;
  await db`delete from app.preparation_resource_relation where resource_id=${id}::uuid`;
  for (const [index, target] of data.relatedResourceIds.entries())
    await db`insert into app.preparation_resource_relation(resource_id,related_resource_id,position) values(${id}::uuid,${target}::uuid,${index + 1})`;
  await db`delete from app.preparation_resource_link where resource_id=${id}::uuid`;
  for (const [index, link] of data.links.entries())
    await db`insert into app.preparation_resource_link(resource_id,link_type,label,url,position) values(${id}::uuid,${link.type},${link.label},${link.url},${index + 1})`;
}

export async function updateResource(
  adminId: string,
  id: string,
  expectedVersion: number,
  input: FormData,
  intent: string,
) {
  const parsed = draft(input);
  if (!parsed.ok) return parsed;
  return withApplicationUser(adminId, async (db) => {
    const current = (
      await db<AdminResource[]>`${db.unsafe(resourceSelect)} where r.id=${id}::uuid for update of r`
    )[0];
    if (!current) return { ok: false as const, error: "Content was not found." };
    if (current.version !== expectedVersion) return { ok: false as const, conflict: true as const };
    const state =
      intent === "publish"
        ? "published"
        : intent === "unpublish" || intent === "restore"
          ? "draft"
          : intent === "archive"
            ? "archived"
            : current.publicationState;
    if (!["save", "publish", "unpublish", "archive", "restore"].includes(intent))
      return { ok: false as const, error: "Invalid action." };
    if (current.firstPublishedAt && parsed.data.slug !== current.slug)
      return { ok: false as const, error: "The slug cannot change after first publication." };
    if (state === "published" && (!parsed.data.title || !parsed.data.shortDescription))
      return { ok: false as const, error: "A title and summary are required for publication." };
    if (!(await validateAssociations(db, id, parsed.data, state === "published", current.tagIds)))
      return {
        ok: false as const,
        error: "Content associations are unavailable or invalid for publication.",
      };
    const same =
      current.accessLevel === parsed.data.accessLevel &&
      current.estimatedMinutes === parsed.data.estimatedMinutes &&
      current.markdownBody === parsed.data.markdownBody &&
      current.primaryCategoryId === parsed.data.primaryCategoryId &&
      current.publicationState === state &&
      current.resourceType === parsed.data.resourceType &&
      current.shortDescription === parsed.data.shortDescription &&
      current.slug === parsed.data.slug &&
      current.title === parsed.data.title &&
      current.youtubeVideoId === parsed.data.youtubeVideoId &&
      sameArray(current.opportunityTypes, [...parsed.data.opportunityTypes].sort()) &&
      sameArray(current.stages, [...parsed.data.stages].sort()) &&
      sameArray(current.tagIds, [...parsed.data.tagIds].sort()) &&
      sameArray(current.relatedResourceIds, parsed.data.relatedResourceIds) &&
      current.links.length === parsed.data.links.length &&
      current.links.every((link, index) => {
        const next = parsed.data.links[index];
        return (
          !!next && link.type === next.type && link.label === next.label && link.url === next.url
        );
      });
    if (same) return { ok: true as const, outcome: "unchanged" as const, version: current.version };
    const rows = await db<
      { version: number }[]
    >`update app.preparation_resource set slug=${parsed.data.slug},title=${parsed.data.title},short_description=${parsed.data.shortDescription},resource_type=${parsed.data.resourceType},access_level=${parsed.data.accessLevel},markdown_body=${parsed.data.markdownBody},primary_category_id=${parsed.data.primaryCategoryId}::uuid,estimated_minutes=${parsed.data.estimatedMinutes},youtube_video_id=${parsed.data.youtubeVideoId},publication_state=${state},published_at=case when ${state}='published' then clock_timestamp() else null end,first_published_at=case when ${state}='published' then coalesce(first_published_at,clock_timestamp()) else first_published_at end,archived_at=case when ${state}='archived' then clock_timestamp() else null end where id=${id}::uuid and version=${expectedVersion} returning version`;
    if (!rows[0]) return { ok: false as const, conflict: true as const };
    await replaceAssociations(db, id, parsed.data);
    const action =
      intent === "publish"
        ? "content.published"
        : intent === "unpublish"
          ? "content.unpublished"
          : intent === "archive"
            ? "content.archived"
            : intent === "restore"
              ? "content.restored"
              : "content.updated";
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,${action},'preparation_resource',${id}::uuid,'{}')`;
    return { ok: true as const, outcome: "changed" as const, version: rows[0].version };
  });
}
