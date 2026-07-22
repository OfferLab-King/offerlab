import "server-only";
import { createHash } from "node:crypto";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import type { TransactionSql } from "postgres";
import {
  duplicateResourceIds,
  learningPathDraftSchema,
  pathsEqual,
  publicationErrors,
} from "../domain/learning-path";
import {
  adminCategories,
  adminResources,
  getAdminPath,
  listAdminPaths,
} from "../infrastructure/learning-path-repository";

export const readAdminPaths = (adminId: string) => withApplicationUser(adminId, listAdminPaths);
export const readAdminPath = (adminId: string, id: string) =>
  zUuid(id) ? withApplicationUser(adminId, (db) => getAdminPath(db, id)) : Promise.resolve(null);
export const readPathEditorOptions = (adminId: string) =>
  withApplicationUser(adminId, async (db) => ({
    categories: await adminCategories(db),
    resources: await adminResources(db),
  }));

function parse(form: FormData) {
  const allowedFields = new Set([
    "expectedVersion",
    "intent",
    "introduction",
    "primaryCategoryId",
    "sections",
    "shortDescription",
    "slug",
    "title",
  ]);
  if ([...form.keys()].some((key) => !allowedFields.has(key) && !key.startsWith("$ACTION_")))
    return { ok: false as const, error: "The path contains an unknown field." };
  let sections: unknown = [];
  try {
    sections = JSON.parse(String(form.get("sections") ?? "[]"));
  } catch {
    return { ok: false as const, error: "The section structure is invalid." };
  }
  const parsed = learningPathDraftSchema.safeParse({
    introduction: String(form.get("introduction") ?? ""),
    primaryCategoryId: String(form.get("primaryCategoryId") ?? ""),
    sections,
    shortDescription: String(form.get("shortDescription") ?? ""),
    slug: String(form.get("slug") ?? ""),
    title: String(form.get("title") ?? ""),
  });
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid path." };
  if (duplicateResourceIds(parsed.data.sections).length)
    return { ok: false as const, error: "A resource can appear only once in a path." };
  return { ok: true as const, data: parsed.data };
}

function zUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function structureFingerprint(sections: readonly unknown[]) {
  return createHash("sha256").update(JSON.stringify(sections)).digest("hex");
}

export async function createPathDraft(adminId: string, form: FormData) {
  const parsed = parse(form);
  if (!parsed.ok) return parsed;
  return withApplicationUser(adminId, async (db) => {
    const key = `path_${crypto.randomUUID().replaceAll("-", "")}`;
    const rows = await db<
      { id: string }[]
    >`insert into app.learning_path(path_key,slug,title,short_description,introduction,structure_fingerprint,primary_category_id) values(${key},${parsed.data.slug},${parsed.data.title},${parsed.data.shortDescription},${parsed.data.introduction},${structureFingerprint(parsed.data.sections)},${parsed.data.primaryCategoryId}::uuid) returning id`;
    await replaceStructure(db, rows[0]!.id, parsed.data.sections);
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,'learning_path.created','learning_path',${rows[0]!.id}::uuid,'{}')`;
    return { ok: true as const, id: rows[0]!.id };
  });
}

type Db = TransactionSql;
async function replaceStructure(
  db: Db,
  pathId: string,
  sections: readonly {
    description: string;
    heading: string;
    items: readonly { contextNote: string; resourceId: string }[];
  }[],
) {
  await db`delete from app.learning_path_section where learning_path_id=${pathId}::uuid`;
  for (const [sectionIndex, section] of sections.entries()) {
    const row = (
      await db<
        { id: string }[]
      >`insert into app.learning_path_section(learning_path_id,heading,short_description,position) values(${pathId}::uuid,${section.heading},${section.description},${sectionIndex + 1}) returning id`
    )[0]!;
    for (const [itemIndex, item] of section.items.entries())
      await db`insert into app.learning_path_item(learning_path_id,section_id,preparation_resource_id,position,context_note) values(${pathId}::uuid,${row.id}::uuid,${item.resourceId}::uuid,${itemIndex + 1},${item.contextNote})`;
  }
}

export async function updatePath(
  adminId: string,
  pathId: string,
  expectedVersion: number,
  form: FormData,
  intent: string,
) {
  if (!zUuid(pathId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
    return { ok: false as const, error: "Invalid path request." };
  const parsed = parse(form);
  if (!parsed.ok) return parsed;
  return withApplicationUser(adminId, async (db) => {
    const current = await getAdminPath(db, pathId);
    if (!current) return { ok: false as const, error: "Path not found." };
    if (current.version !== expectedVersion) return { ok: false as const, conflict: true as const };
    const allowedIntents =
      current.publicationState === "archived"
        ? ["restore"]
        : current.publicationState === "published"
          ? ["save", "unpublish", "archive"]
          : ["save", "publish", "archive"];
    if (!allowedIntents.includes(intent))
      return { ok: false as const, error: "This lifecycle action is not available." };
    if (current.firstPublishedAt && current.slug !== parsed.data.slug)
      return { ok: false as const, error: "The slug cannot change after first publication." };
    const state =
      intent === "publish"
        ? "published"
        : intent === "unpublish" || intent === "restore"
          ? "draft"
          : intent === "archive"
            ? "archived"
            : current.publicationState;
    if (state === "published") {
      const errors = publicationErrors(parsed.data);
      if (errors.length) return { ok: false as const, error: errors[0]! };
      const resourceIds = parsed.data.sections.flatMap((section) =>
        section.items.map((item) => item.resourceId),
      );
      const resources = await db<
        { id: string }[]
      >`select r.id from app.preparation_resource r join app.content_category c on c.id=r.primary_category_id and c.archived_at is null where r.id=any(${resourceIds}::uuid[]) and r.publication_state='published'`;
      if (
        resources.length !== resourceIds.length ||
        duplicateResourceIds(parsed.data.sections).length
      )
        return {
          ok: false as const,
          error: "Every resource must be unique, published, and member-accessible.",
        };
      if (
        parsed.data.primaryCategoryId &&
        !(
          await db`select id from app.content_category where id=${parsed.data.primaryCategoryId}::uuid and archived_at is null`
        )[0]
      )
        return { ok: false as const, error: "Choose an active category." };
    }
    const draft = {
      introduction: current.introduction,
      primaryCategoryId: current.primaryCategoryId,
      sections: current.sections,
      shortDescription: current.shortDescription,
      slug: current.slug,
      title: current.title,
    };
    if (current.publicationState === state && pathsEqual(draft, parsed.data))
      return { ok: true as const, outcome: "unchanged" as const, version: current.version };
    const rows = await db<
      { version: number }[]
    >`update app.learning_path set slug=${parsed.data.slug},title=${parsed.data.title},short_description=${parsed.data.shortDescription},introduction=${parsed.data.introduction},structure_fingerprint=${structureFingerprint(parsed.data.sections)},primary_category_id=${parsed.data.primaryCategoryId}::uuid,publication_state=${state},published_at=case when ${state}='published' then clock_timestamp() else null end,first_published_at=case when ${state}='published' then coalesce(first_published_at,clock_timestamp()) else first_published_at end,archived_at=case when ${state}='archived' then clock_timestamp() else null end where id=${pathId}::uuid and version=${expectedVersion} returning version`;
    if (!rows[0]) return { ok: false as const, conflict: true as const };
    await replaceStructure(db, pathId, parsed.data.sections);
    const action =
      intent === "publish"
        ? "learning_path.published"
        : intent === "unpublish"
          ? "learning_path.unpublished"
          : intent === "archive"
            ? "learning_path.archived"
            : intent === "restore"
              ? "learning_path.restored"
              : "learning_path.updated";
    await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${adminId}::uuid,${action},'learning_path',${pathId}::uuid,'{}')`;
    return { ok: true as const, outcome: "changed" as const, version: rows[0].version };
  });
}
