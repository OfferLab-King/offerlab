import type { TransactionSql } from "postgres";
import {
  calculateProgress,
  firstIncomplete,
  type LearningPathDraftInput,
} from "../domain/learning-path";

export type PathItem = Readonly<{
  completedAt: Date | null;
  contextNote: string;
  estimatedMinutes: number | null;
  id: string;
  resourceId: string;
  resourceType: string;
  slug: string;
  title: string;
}>;
export type PathSection = Readonly<{
  description: string;
  heading: string;
  id: string;
  items: readonly PathItem[];
}>;
export type MemberPath = Readonly<{
  categoryName: string | null;
  completedCount: number;
  estimatedMinutes: number;
  following: boolean;
  id: string;
  introduction: string;
  progress: number;
  sections: readonly PathSection[];
  shortDescription: string;
  slug: string;
  title: string;
  totalCount: number;
}>;

type MemberRow = Omit<
  MemberPath,
  "completedCount" | "estimatedMinutes" | "following" | "progress" | "sections" | "totalCount"
> & { category_name: string | null; following: boolean; sections: PathSection[] };

export async function listMemberPaths(
  db: TransactionSql,
  ownerId: string,
): Promise<readonly MemberPath[]> {
  const rows = await db<MemberRow[]>`
    select p.id,p.slug,p.title,p.short_description "shortDescription",p.introduction,c.name category_name,
      exists(select 1 from app.member_learning_path_state ps where ps.learning_path_id=p.id and ps.owner_user_id=${ownerId}::uuid and ps.started_at is not null and ps.stopped_at is null) following,
      coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'heading',s.heading,'description',s.short_description,'items',
        coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'resourceId',r.id,'slug',r.slug,'title',r.title,'resourceType',r.resource_type,'estimatedMinutes',r.estimated_minutes,'contextNote',i.context_note,'completedAt',ms.completed_at) order by i.position)
          from app.learning_path_item i join app.preparation_resource r on r.id=i.preparation_resource_id and r.publication_state='published' join app.content_category rc on rc.id=r.primary_category_id and rc.archived_at is null left join app.member_resource_state ms on ms.resource_id=r.id and ms.owner_user_id=${ownerId}::uuid where i.section_id=s.id),'[]'::jsonb)) order by s.position) from app.learning_path_section s where s.learning_path_id=p.id),'[]'::jsonb) sections
    from app.learning_path p left join app.content_category c on c.id=p.primary_category_id and c.archived_at is null
    where p.publication_state='published' and (p.primary_category_id is null or c.id is not null) and exists(select 1 from app.learning_path_section s join app.learning_path_item i on i.section_id=s.id join app.preparation_resource r on r.id=i.preparation_resource_id join app.content_category rc on rc.id=r.primary_category_id and rc.archived_at is null where s.learning_path_id=p.id and r.publication_state='published') order by p.title,p.id`;
  return rows.map((row) => {
    const items = row.sections.flatMap((section) => section.items);
    const completedCount = items.filter((item) => item.completedAt).length;
    return {
      ...row,
      categoryName: row.category_name,
      completedCount,
      estimatedMinutes: items.reduce((total, item) => total + (item.estimatedMinutes ?? 0), 0),
      progress: calculateProgress(completedCount, items.length),
      totalCount: items.length,
    };
  });
}

export async function findMemberPath(db: TransactionSql, ownerId: string, slug: string) {
  return (await listMemberPaths(db, ownerId)).find((path) => path.slug === slug) ?? null;
}

export function continueItem(path: MemberPath) {
  return firstIncomplete(path.sections.flatMap((section) => section.items));
}

export async function pathsForResource(db: TransactionSql, resourceId: string) {
  return db<
    { slug: string; title: string }[]
  >`select p.slug,p.title from app.learning_path p left join app.content_category c on c.id=p.primary_category_id and c.archived_at is null join app.learning_path_section s on s.learning_path_id=p.id join app.learning_path_item i on i.section_id=s.id where i.preparation_resource_id=${resourceId}::uuid and p.publication_state='published' and (p.primary_category_id is null or c.id is not null) group by p.id order by p.title,p.id`;
}

export async function completedPublishedPathIdsContainingResource(
  db: TransactionSql,
  ownerId: string,
  resourceId: string,
) {
  const rows = await db<{ id: string }[]>`
    select p.id from app.learning_path p
    left join app.content_category path_category on path_category.id=p.primary_category_id and path_category.archived_at is null
    join app.learning_path_section target_section on target_section.learning_path_id=p.id
    join app.learning_path_item target_item on target_item.section_id=target_section.id and target_item.preparation_resource_id=${resourceId}::uuid
    join app.learning_path_section s on s.learning_path_id=p.id
    join app.learning_path_item i on i.section_id=s.id
    join app.preparation_resource r on r.id=i.preparation_resource_id and r.publication_state='published'
    join app.content_category c on c.id=r.primary_category_id and c.archived_at is null
    left join app.member_resource_state state on state.resource_id=r.id and state.owner_user_id=${ownerId}::uuid
    where p.publication_state='published' and (p.primary_category_id is null or path_category.id is not null)
    group by p.id having count(*)>0 and bool_and(state.completed_at is not null)
    order by p.id`;
  return rows.map((row) => row.id);
}

export async function changeFollowing(
  db: TransactionSql,
  ownerId: string,
  pathId: string,
  follow: boolean,
) {
  const current = (
    await db<
      { id: string; started_at: Date | null; stopped_at: Date | null }[]
    >`select id,started_at,stopped_at from app.member_learning_path_state where owner_user_id=${ownerId}::uuid and learning_path_id=${pathId}::uuid for update`
  )[0];
  if (
    (follow && current?.started_at && !current.stopped_at) ||
    (!follow && (!current?.started_at || current.stopped_at))
  )
    return "unchanged" as const;
  const rows = await db<
    { id: string }[]
  >`insert into app.member_learning_path_state(owner_user_id,learning_path_id,started_at,stopped_at) values(${ownerId}::uuid,${pathId}::uuid,${follow ? new Date() : null},${follow ? null : new Date()}) on conflict(owner_user_id,learning_path_id) do update set started_at=case when ${follow} then clock_timestamp() else app.member_learning_path_state.started_at end,stopped_at=case when ${follow} then null else clock_timestamp() end,updated_at=clock_timestamp() returning id`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${ownerId}::uuid,${follow ? "learning_path.started" : "learning_path.stopped"},'member_learning_path_state',${rows[0]!.id}::uuid,'{}')`;
  return "changed" as const;
}

export type AdminPath = LearningPathDraftInput &
  Readonly<{
    firstPublishedAt: Date | null;
    id: string;
    pathKey: string;
    publicationState: "draft" | "published" | "archived";
    version: number;
  }>;
export async function listAdminPaths(db: TransactionSql) {
  return db<
    {
      id: string;
      publicationState: AdminPath["publicationState"];
      slug: string;
      title: string;
      version: number;
    }[]
  >`select id,publication_state "publicationState",slug,title,version from app.learning_path order by created_at desc`;
}
export async function adminResources(db: TransactionSql) {
  return db<
    { id: string; publicationState: string; title: string }[]
  >`select id,publication_state "publicationState",title from app.preparation_resource order by title,id`;
}
export async function adminCategories(db: TransactionSql) {
  return db<
    { id: string; name: string }[]
  >`select id,name from app.content_category where archived_at is null order by name,id`;
}
export async function getAdminPath(db: TransactionSql, id: string): Promise<AdminPath | null> {
  const row = (
    await db<
      (Omit<AdminPath, "sections" | "primaryCategoryId"> & {
        primaryCategoryId: string | null;
        sections: PathSection[];
      })[]
    >`select p.id,p.path_key "pathKey",p.slug,p.title,p.short_description "shortDescription",p.introduction,p.primary_category_id "primaryCategoryId",p.publication_state "publicationState",p.first_published_at "firstPublishedAt",p.version,coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'heading',s.heading,'description',s.short_description,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'resourceId',i.preparation_resource_id,'contextNote',i.context_note) order by i.position) from app.learning_path_item i where i.section_id=s.id),'[]'::jsonb)) order by s.position) from app.learning_path_section s where s.learning_path_id=p.id),'[]'::jsonb) sections from app.learning_path p where p.id=${id}::uuid`
  )[0];
  return row
    ? {
        ...row,
        sections: row.sections.map((section) => ({
          description: section.description,
          heading: section.heading,
          items: section.items.map((item) => ({
            contextNote: item.contextNote,
            resourceId: item.resourceId,
          })),
        })),
      }
    : null;
}
