import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { nextAction, parseAnswer, parseStory, type CompetencyKey } from "../domain/answer-bank";
import * as repo from "../infrastructure/answer-bank-repository";
export const readStories = (owner: string, archived = false) =>
  withApplicationUser(owner, (db) => repo.listStories(db, owner, archived));
export const readStory = (owner: string, id: string) =>
  withApplicationUser(owner, (db) => repo.findStory(db, owner, id));
export const readAnswers = (owner: string, archived = false) =>
  withApplicationUser(owner, (db) => repo.listAnswers(db, owner, archived));
export const readAnswer = (owner: string, id: string) =>
  withApplicationUser(owner, (db) => repo.findAnswer(db, owner, id));
export const readQuestions = (owner: string) =>
  withApplicationUser(owner, (db) => repo.listQuestions(db, owner));
export async function addStory(owner: string, input: unknown) {
  const p = parseStory(input);
  if (!p.ok) return p;
  return {
    ok: true,
    item: await withApplicationUser(owner, (db) => repo.createStory(db, owner, p.value)),
  } as const;
}
export async function editStory(owner: string, id: string, version: number, input: unknown) {
  const p = parseStory(input);
  if (!p.ok) return p;
  return {
    ok: true,
    ...(await withApplicationUser(owner, (db) =>
      repo.updateStory(db, owner, id, version, p.value),
    )),
  } as const;
}
export const setStoryArchived = (owner: string, id: string, version: number, archive: boolean) =>
  withApplicationUser(owner, (db) => repo.archiveStory(db, owner, id, version, archive));
export async function addAnswer(owner: string, input: unknown) {
  const p = parseAnswer(input);
  if (!p.ok) return p;
  return {
    ok: true,
    item: await withApplicationUser(owner, (db) => repo.createAnswer(db, owner, p.value)),
  } as const;
}
export async function editAnswer(owner: string, id: string, version: number, input: unknown) {
  const p = parseAnswer(input);
  if (!p.ok) return p;
  return {
    ok: true,
    ...(await withApplicationUser(owner, (db) =>
      repo.updateAnswer(db, owner, id, version, p.value),
    )),
  } as const;
}
export const setAnswerArchived = (owner: string, id: string, version: number, archive: boolean) =>
  withApplicationUser(owner, (db) => repo.archiveAnswer(db, owner, id, version, archive));
export async function readAnswerBankSummary(owner: string) {
  const [stories, answers, questions] = await Promise.all([
    readStories(owner),
    readAnswers(owner),
    readQuestions(owner),
  ]);
  const covered = [
    ...new Set(stories.filter((x) => x.ready).flatMap((x) => x.competencies)),
  ] as CompetencyKey[];
  const readyStories = stories.filter((x) => x.ready).length,
    readyAnswers = answers.filter((x) => x.ready).length;
  return {
    stories: stories.length,
    readyStories,
    answers: answers.length,
    readyAnswers,
    competenciesCovered: covered.length,
    covered,
    questionTotal: questions.length,
    questionsReady: questions.filter((x) => x.status === "Ready").length,
    nextAction: nextAction({
      readyStories,
      readyAnswers,
      covered,
      personalIntroduction: answers.some((x) => x.questionFamily === "personal_introduction"),
    }),
  };
}
