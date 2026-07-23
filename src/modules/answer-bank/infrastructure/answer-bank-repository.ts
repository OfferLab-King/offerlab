import type { TransactionSql } from "postgres";
import type {
  AnswerValues,
  CompetencyKey,
  QuestionFamily,
  StoryValues,
} from "../domain/answer-bank";
export type Story = StoryValues & {
  id: string;
  version: number;
  readyAt: Date | null;
  archivedAt: Date | null;
  updatedAt: Date;
  answerCount: number;
};
export type Answer = AnswerValues & {
  id: string;
  version: number;
  readyAt: Date | null;
  archivedAt: Date | null;
  updatedAt: Date;
  question: string;
  applicationLabel: string | null;
};
export type Question = {
  id: string;
  prompt: string;
  family: QuestionFamily;
  guidance: string;
  stages: string[];
  status: "Not started" | "Draft" | "Ready";
};
const storyCols = `s.id,s.title,s.experience_type,s.situation,s.task,s.actions,s.reasoning,s.result,s.reflection,s.summary,s.ready_at,s.archived_at,s.version,s.updated_at,
 coalesce((select array_agg(c.stable_key order by c.position) from app.member_story_competency sc join app.competency c on c.id=sc.competency_id where sc.story_id=s.id),'{}') competencies,
 (select count(*)::int from app.member_answer_story mas where mas.story_id=s.id) answer_count`;
type SR = Readonly<{
  actions: string;
  answer_count: number;
  application_id: string | null;
  application_label: string | null;
  archived_at: Date | null;
  competencies: CompetencyKey[];
  custom_question: string | null;
  draft_answer: string;
  experience_type: StoryValues["experienceType"];
  guidance: string;
  id: string;
  key_points: string;
  prompt: string;
  question: string;
  question_family: QuestionFamily;
  question_id: string | null;
  ready_at: Date | null;
  reasoning: string;
  recruitment_stage: string | null;
  reflection: string;
  result: string;
  situation: string;
  stages: string[];
  status: string;
  story_ids: string[];
  summary: string | null;
  task: string;
  title: string;
  updated_at: Date;
  version: number;
}>;
const story = (r: SR): Story => ({
  id: r.id,
  title: r.title,
  experienceType: r.experience_type,
  situation: r.situation,
  task: r.task,
  actions: r.actions,
  reasoning: r.reasoning,
  result: r.result,
  reflection: r.reflection,
  summary: r.summary,
  competencies: r.competencies as CompetencyKey[],
  ready: Boolean(r.ready_at),
  readyAt: r.ready_at,
  archivedAt: r.archived_at,
  version: r.version,
  updatedAt: r.updated_at,
  answerCount: r.answer_count,
});
async function audit(
  db: TransactionSql,
  owner: string,
  id: string,
  entity: "story" | "answer",
  action: string,
) {
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata) values(${owner}::uuid,${`${entity}.${action}`},${entity === "story" ? "member_story" : "member_answer"},${id}::uuid,'{}')`;
}
export async function listStories(db: TransactionSql, owner: string, archived = false) {
  return (
    await db.unsafe<SR[]>(
      `select ${storyCols} from app.member_story s where s.owner_user_id=$1::uuid and s.archived_at is ${archived ? "not " : ""}null order by s.updated_at desc`,
      [owner],
    )
  ).map(story);
}
export async function findStory(db: TransactionSql, owner: string, id: string) {
  const r = await db.unsafe<SR[]>(
    `select ${storyCols} from app.member_story s where s.owner_user_id=$1::uuid and s.id=$2::uuid`,
    [owner, id],
  );
  return r[0] ? story(r[0]) : null;
}
async function setCompetencies(
  db: TransactionSql,
  owner: string,
  id: string,
  keys: readonly CompetencyKey[],
) {
  await db`delete from app.member_story_competency where owner_user_id=${owner}::uuid and story_id=${id}::uuid`;
  if (keys.length)
    await db`insert into app.member_story_competency(owner_user_id,story_id,competency_id) select ${owner}::uuid,${id}::uuid,id from app.competency where stable_key=any(${keys as string[]})`;
}
export async function createStory(db: TransactionSql, owner: string, v: StoryValues) {
  const r = await db<
    SR[]
  >`insert into app.member_story(owner_user_id,title,experience_type,situation,task,actions,reasoning,result,reflection,summary,ready_at) values(${owner}::uuid,${v.title},${v.experienceType},${v.situation},${v.task},${v.actions},${v.reasoning},${v.result},${v.reflection},${v.summary},case when ${v.ready} then now() end) returning id`;
  const id = r[0]!.id;
  await setCompetencies(db, owner, id, v.competencies);
  if (v.competencies.length)
    await db`update app.member_story set relation_revision=relation_revision+1 where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  await audit(db, owner, id, "story", "created");
  return (await findStory(db, owner, id))!;
}
export async function updateStory(
  db: TransactionSql,
  owner: string,
  id: string,
  expected: number,
  v: StoryValues,
) {
  const current = await findStory(db, owner, id);
  if (!current || current.archivedAt) return { outcome: "not_found" } as const;
  if (current.version !== expected) return { outcome: "conflict" } as const;
  const same =
    current.title === v.title &&
    current.experienceType === v.experienceType &&
    current.situation === v.situation &&
    current.task === v.task &&
    current.actions === v.actions &&
    current.reasoning === v.reasoning &&
    current.result === v.result &&
    current.reflection === v.reflection &&
    current.summary === v.summary &&
    current.ready === v.ready &&
    JSON.stringify(current.competencies) === JSON.stringify(v.competencies);
  if (same) return { outcome: "unchanged", item: current } as const;
  const comps = JSON.stringify(current.competencies) === JSON.stringify(v.competencies);
  await db`update app.member_story set title=${v.title},experience_type=${v.experienceType},situation=${v.situation},task=${v.task},actions=${v.actions},reasoning=${v.reasoning},result=${v.result},reflection=${v.reflection},summary=${v.summary},ready_at=case when ${v.ready} then coalesce(ready_at,now()) else null end,relation_revision=relation_revision+${comps ? 0 : 1} where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  if (!comps) await setCompetencies(db, owner, id, v.competencies);
  const action =
    current.ready !== v.ready ? (v.ready ? "marked_ready" : "marked_draft") : "updated";
  await audit(db, owner, id, "story", action);
  return { outcome: "changed", item: (await findStory(db, owner, id))! } as const;
}
export async function archiveStory(
  db: TransactionSql,
  owner: string,
  id: string,
  expected: number,
  archive: boolean,
) {
  const current = await findStory(db, owner, id);
  if (!current) return { outcome: "not_found" } as const;
  if (current.version !== expected) return { outcome: "conflict" } as const;
  if (Boolean(current.archivedAt) === archive)
    return { outcome: "unchanged", item: current } as const;
  await db`update app.member_story set archived_at=case when ${archive} then now() else null end where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  await audit(db, owner, id, "story", archive ? "archived" : "restored");
  return { outcome: "changed", item: (await findStory(db, owner, id))! } as const;
}

const answerCols = `a.*,coalesce(q.prompt,a.custom_question) question,case when ap.id is null then null else ap.company_name||' — '||ap.role_title end application_label,coalesce((select array_agg(mas.story_id order by mas.position) from app.member_answer_story mas where mas.answer_id=a.id),'{}') story_ids`;
const answer = (r: SR): Answer => ({
  id: r.id,
  questionId: r.question_id,
  customQuestion: r.custom_question,
  questionFamily: r.question_family,
  title: r.title,
  keyPoints: r.key_points,
  draftAnswer: r.draft_answer,
  applicationId: r.application_id,
  recruitmentStage: r.recruitment_stage,
  storyIds: r.story_ids,
  ready: Boolean(r.ready_at),
  readyAt: r.ready_at,
  archivedAt: r.archived_at,
  version: r.version,
  updatedAt: r.updated_at,
  question: r.question,
  applicationLabel: r.application_label,
});
export async function listAnswers(db: TransactionSql, owner: string, archived = false) {
  return (
    await db.unsafe<SR[]>(
      `select ${answerCols} from app.member_answer a left join app.interview_question q on q.id=a.question_id left join app.application ap on ap.id=a.application_id and ap.owner_user_id=a.owner_user_id where a.owner_user_id=$1::uuid and a.archived_at is ${archived ? "not " : ""}null order by a.updated_at desc`,
      [owner],
    )
  ).map(answer);
}
export async function findAnswer(db: TransactionSql, owner: string, id: string) {
  const r = await db.unsafe<SR[]>(
    `select ${answerCols} from app.member_answer a left join app.interview_question q on q.id=a.question_id left join app.application ap on ap.id=a.application_id and ap.owner_user_id=a.owner_user_id where a.owner_user_id=$1::uuid and a.id=$2::uuid`,
    [owner, id],
  );
  return r[0] ? answer(r[0]) : null;
}
async function setStories(db: TransactionSql, owner: string, id: string, ids: readonly string[]) {
  const existingRows = await db<
    { story_id: string }[]
  >`select story_id from app.member_answer_story where owner_user_id=${owner}::uuid and answer_id=${id}::uuid`;
  const existingIds = existingRows.map((row) => row.story_id);
  await db`delete from app.member_answer_story where owner_user_id=${owner}::uuid and answer_id=${id}::uuid`;
  for (let i = 0; i < ids.length; i++) {
    const storyId = ids[i]!;
    await db`insert into app.member_answer_story(owner_user_id,answer_id,story_id,position) select ${owner}::uuid,${id}::uuid,${storyId}::uuid,${i + 1} where exists(select 1 from app.member_story where id=${storyId}::uuid and owner_user_id=${owner}::uuid and (archived_at is null or id=any(${existingIds}::uuid[])))`;
  }
  const count = await db<
    { n: number }[]
  >`select count(*)::int n from app.member_answer_story where answer_id=${id}::uuid`;
  if (count[0]!.n !== ids.length) throw new Error("answer_story_not_owned");
}
export async function createAnswer(db: TransactionSql, owner: string, v: AnswerValues) {
  if (v.applicationId) {
    const x =
      await db`select 1 from app.application where id=${v.applicationId}::uuid and owner_user_id=${owner}::uuid and archived_at is null`;
    if (!x.length) throw new Error("application_not_owned");
  }
  const r = await db<
    SR[]
  >`insert into app.member_answer(owner_user_id,question_id,custom_question,question_family,title,key_points,draft_answer,application_id,recruitment_stage,ready_at) values(${owner}::uuid,${v.questionId}::uuid,${v.customQuestion},${v.questionFamily},${v.title},${v.keyPoints},${v.draftAnswer},${v.applicationId}::uuid,${v.recruitmentStage},case when ${v.ready} then now() end) returning id`;
  const id = r[0]!.id;
  await setStories(db, owner, id, v.storyIds);
  if (v.storyIds.length)
    await db`update app.member_answer set relation_revision=relation_revision+1 where id=${id}::uuid`;
  await audit(db, owner, id, "answer", "created");
  return (await findAnswer(db, owner, id))!;
}
export async function updateAnswer(
  db: TransactionSql,
  owner: string,
  id: string,
  expected: number,
  v: AnswerValues,
) {
  const current = await findAnswer(db, owner, id);
  if (!current || current.archivedAt) return { outcome: "not_found" } as const;
  if (current.version !== expected) return { outcome: "conflict" } as const;
  if (v.applicationId) {
    const x =
      await db`select 1 from app.application where id=${v.applicationId}::uuid and owner_user_id=${owner}::uuid and archived_at is null`;
    if (!x.length) throw new Error("application_not_owned");
  }
  const links = JSON.stringify(current.storyIds) === JSON.stringify(v.storyIds);
  const same =
    links &&
    current.questionId === v.questionId &&
    current.customQuestion === v.customQuestion &&
    current.questionFamily === v.questionFamily &&
    current.title === v.title &&
    current.keyPoints === v.keyPoints &&
    current.draftAnswer === v.draftAnswer &&
    current.applicationId === v.applicationId &&
    current.recruitmentStage === v.recruitmentStage &&
    current.ready === v.ready;
  if (same) return { outcome: "unchanged", item: current } as const;
  await db`update app.member_answer set question_id=${v.questionId}::uuid,custom_question=${v.customQuestion},question_family=${v.questionFamily},title=${v.title},key_points=${v.keyPoints},draft_answer=${v.draftAnswer},application_id=${v.applicationId}::uuid,recruitment_stage=${v.recruitmentStage},ready_at=case when ${v.ready} then coalesce(ready_at,now()) else null end,relation_revision=relation_revision+${links ? 0 : 1} where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  if (!links) await setStories(db, owner, id, v.storyIds);
  await audit(
    db,
    owner,
    id,
    "answer",
    current.ready !== v.ready ? (v.ready ? "marked_ready" : "marked_draft") : "updated",
  );
  return { outcome: "changed", item: (await findAnswer(db, owner, id))! } as const;
}
export async function archiveAnswer(
  db: TransactionSql,
  owner: string,
  id: string,
  expected: number,
  archive: boolean,
) {
  const current = await findAnswer(db, owner, id);
  if (!current) return { outcome: "not_found" } as const;
  if (current.version !== expected) return { outcome: "conflict" } as const;
  if (Boolean(current.archivedAt) === archive)
    return { outcome: "unchanged", item: current } as const;
  await db`update app.member_answer set archived_at=case when ${archive} then now() else null end where id=${id}::uuid and owner_user_id=${owner}::uuid`;
  await audit(db, owner, id, "answer", archive ? "archived" : "restored");
  return { outcome: "changed", item: (await findAnswer(db, owner, id))! } as const;
}
export async function listQuestions(db: TransactionSql, owner: string) {
  const r = await db<
    SR[]
  >`select q.id,q.prompt,q.question_family,q.guidance,coalesce(array_agg(qs.recruitment_stage) filter(where qs.recruitment_stage is not null),'{}') stages,case when bool_or(a.ready_at is not null) then 'Ready' when count(a.id)>0 then 'Draft' else 'Not started' end status from app.interview_question q left join app.interview_question_stage qs on qs.question_id=q.id left join app.member_answer a on a.question_id=q.id and a.owner_user_id=${owner}::uuid and a.archived_at is null where q.active group by q.id order by q.position`;
  return r.map((x) => ({
    id: x.id,
    prompt: x.prompt,
    family: x.question_family,
    guidance: x.guidance,
    stages: x.stages,
    status: x.status,
  })) as Question[];
}
