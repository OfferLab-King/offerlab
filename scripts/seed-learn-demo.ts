import postgres from "postgres";
import { createHash } from "node:crypto";
import { loadLocalEnvironment } from "./shared/load-local-environment";
import { demoPlans, demoResources, isLocalDatabaseUrl } from "./learn-demo-content";

loadLocalEnvironment();
const confirmed = process.argv.includes("--confirm-local");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!confirmed)
  throw new Error("Refusing to seed: pass --confirm-local for local demonstration content.");
if (!databaseUrl) throw new Error("Refusing to seed: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl))
  throw new Error(
    "Refusing to seed: DATABASE_MIGRATION_URL must use an approved local database host.",
  );

const db = postgres(databaseUrl, { max: 1, onnotice: () => undefined, prepare: false });
let resourcesCreated = 0,
  resourcesUpdated = 0,
  plansCreated = 0,
  plansUpdated = 0;
try {
  await db.begin(async (tx) => {
    const categoryRows = await tx<
      { id: string; slug: string }[]
    >`select id,slug from app.content_category where archived_at is null`;
    const categories = new Map(categoryRows.map((row) => [row.slug, row.id]));
    for (const resource of demoResources) {
      const categoryId = categories.get(resource.category);
      if (!categoryId) throw new Error(`Missing local content category: ${resource.category}`);
      const existing = (
        await tx<
          { id: string }[]
        >`select id from app.preparation_resource where resource_key=${resource.key}`
      )[0];
      const row = (
        await tx<{ id: string }[]>`
        insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,publication_state,markdown_body,primary_category_id,estimated_minutes,first_published_at,published_at)
        values(${resource.key},${resource.slug},${resource.title},${resource.description},${resource.type},'member','published',${resource.body},${categoryId}::uuid,${resource.minutes},clock_timestamp(),clock_timestamp())
        on conflict(resource_key) do update set slug=excluded.slug,title=excluded.title,short_description=excluded.short_description,resource_type=excluded.resource_type,access_level='member',publication_state='published',markdown_body=excluded.markdown_body,primary_category_id=excluded.primary_category_id,estimated_minutes=excluded.estimated_minutes,first_published_at=coalesce(app.preparation_resource.first_published_at,clock_timestamp()),published_at=clock_timestamp(),archived_at=null returning id`
      )[0]!;
      if (existing) resourcesUpdated++;
      else resourcesCreated++;
      await tx`delete from app.preparation_resource_stage where resource_id=${row.id}::uuid`;
      for (const stage of resource.stages)
        await tx`insert into app.preparation_resource_stage(resource_id,stage) values(${row.id}::uuid,${stage}) on conflict do nothing`;
    }
    const resourceRows = await tx<
      { id: string; resource_key: string }[]
    >`select id,resource_key from app.preparation_resource where resource_key=any(${demoResources.map((x) => x.key)})`;
    const resourceIds = new Map(resourceRows.map((row) => [row.resource_key, row.id]));
    for (const plan of demoPlans) {
      const categoryId = categories.get(plan.category);
      if (!categoryId) throw new Error(`Missing local content category: ${plan.category}`);
      const fingerprint = createHash("sha256").update(JSON.stringify(plan.sections)).digest("hex");
      const existing = (
        await tx<{ id: string }[]>`select id from app.learning_path where path_key=${plan.key}`
      )[0];
      const row = (
        await tx<{ id: string }[]>`
        insert into app.learning_path(path_key,slug,title,short_description,introduction,structure_fingerprint,publication_state,primary_category_id,first_published_at,published_at)
        values(${plan.key},${plan.slug},${plan.title},${plan.description},${plan.introduction},${fingerprint},'published',${categoryId}::uuid,clock_timestamp(),clock_timestamp())
        on conflict(path_key) do update set slug=excluded.slug,title=excluded.title,short_description=excluded.short_description,introduction=excluded.introduction,structure_fingerprint=excluded.structure_fingerprint,publication_state='published',primary_category_id=excluded.primary_category_id,first_published_at=coalesce(app.learning_path.first_published_at,clock_timestamp()),published_at=clock_timestamp(),archived_at=null returning id`
      )[0]!;
      if (existing) plansUpdated++;
      else plansCreated++;
      await tx`delete from app.learning_path_section where learning_path_id=${row.id}::uuid`;
      for (const [sectionIndex, section] of plan.sections.entries()) {
        const sectionRow = (
          await tx<
            { id: string }[]
          >`insert into app.learning_path_section(learning_path_id,heading,short_description,position) values(${row.id}::uuid,${section.heading},${section.description},${sectionIndex + 1}) returning id`
        )[0]!;
        for (const [itemIndex, resourceKey] of section.resources.entries()) {
          const resourceId = resourceIds.get(resourceKey);
          if (!resourceId) throw new Error(`Missing local demo resource: ${resourceKey}`);
          await tx`insert into app.learning_path_item(learning_path_id,section_id,preparation_resource_id,position,context_note) values(${row.id}::uuid,${sectionRow.id}::uuid,${resourceId}::uuid,${itemIndex + 1},'')`;
        }
      }
    }
  });
  process.stdout.write(
    `Resources created: ${resourcesCreated}\nResources updated: ${resourcesUpdated}\nPlans created: ${plansCreated}\nPlans updated: ${plansUpdated}\nDuplicate records: 0\n`,
  );
} finally {
  await db.end();
}
