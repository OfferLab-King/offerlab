import postgres from "postgres";
import { loadLocalEnvironment } from "./shared/load-local-environment";
import { isLocalDatabaseUrl } from "./learn-demo-content";
loadLocalEnvironment();
const url = process.env.DATABASE_MIGRATION_URL;
if (!process.argv.includes("--confirm-local"))
  throw new Error("Refusing to seed: pass --confirm-local.");
if (!url) throw new Error("Refusing to seed: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(url)) throw new Error("Refusing to seed: database host must be local.");
const questions = [
  ["tell_me_about_yourself", "personal_introduction", "Tell me about yourself."],
  ["why_organisation", "motivation_and_fit", "Why do you want to work for this organisation?"],
  ["why_role", "motivation_and_fit", "Why are you interested in this role?"],
  ["why_industry", "motivation_and_fit", "Why are you interested in this industry?"],
  ["why_select_you", "motivation_and_fit", "Why should we select you?"],
  ["career_goals", "motivation_and_fit", "What are your longer-term career goals?"],
  [
    "teamwork",
    "competency_and_behavioural",
    "Tell me about a time you worked effectively in a team.",
  ],
  ["leadership", "competency_and_behavioural", "Tell me about a time you showed leadership."],
  [
    "problem_solving",
    "competency_and_behavioural",
    "Tell me about a difficult problem you solved.",
  ],
  ["conflict", "competency_and_behavioural", "Tell me about a disagreement or conflict."],
  ["setback", "competency_and_behavioural", "Tell me about a setback or failure."],
  ["resilience", "competency_and_behavioural", "Tell me about a time you showed resilience."],
  ["adapted", "competency_and_behavioural", "Tell me about a time you adapted to change."],
  ["initiative", "competency_and_behavioural", "Tell me about a time you used initiative."],
  [
    "prioritised",
    "competency_and_behavioural",
    "Tell me about a time you prioritised competing tasks.",
  ],
  ["strengths", "self_awareness", "What are your main strengths?"],
  ["development_area", "self_awareness", "What is one development area you are working on?"],
  ["feedback", "self_awareness", "Tell me about feedback you received and acted on."],
  [
    "recent_development",
    "commercial_awareness",
    "Discuss a recent development relevant to this organisation or industry.",
  ],
  ["questions_for_us", "questions_for_interviewer", "What questions would you like to ask us?"],
] as const;
const db = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
let created = 0;
try {
  await db.begin(async (tx) => {
    for (const [i, [key, family, prompt]] of questions.entries()) {
      const existing = await tx`select 1 from app.interview_question where stable_key=${key}`;
      await tx`insert into app.interview_question(stable_key,question_family,prompt,guidance,position) values(${key},${family},${prompt},'Plan a concise, specific answer in your own words.',${i + 1}) on conflict(stable_key) do update set question_family=excluded.question_family,prompt=excluded.prompt,guidance=excluded.guidance,position=excluded.position,active=true`;
      if (!existing.length) created++;
    }
    await tx`insert into app.interview_question_stage(question_id,recruitment_stage) select id,'video_interview' from app.interview_question on conflict do nothing`;
    await tx`insert into app.interview_question_stage(question_id,recruitment_stage) select id,'interview' from app.interview_question on conflict do nothing`;
  });
  process.stdout.write(`Questions created: ${created}\nQuestions present: ${questions.length}\n`);
} finally {
  await db.end();
}
