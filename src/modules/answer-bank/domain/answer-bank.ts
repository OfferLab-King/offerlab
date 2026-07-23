export const experienceTypes = {
  education: "Education",
  employment: "Employment",
  internship: "Internship",
  volunteering: "Volunteering",
  society: "Society",
  personal_project: "Personal project",
  entrepreneurship: "Entrepreneurship",
  caring_responsibility: "Caring responsibility",
  other: "Other",
} as const;
export type ExperienceType = keyof typeof experienceTypes;

export const questionFamilies = {
  personal_introduction: "Personal introduction",
  motivation_and_fit: "Motivation and fit",
  competency_and_behavioural: "Competency and behavioural",
  self_awareness: "Self-awareness",
  commercial_awareness: "Commercial awareness",
  role_specific: "Role-specific",
  technical: "Technical",
  situational: "Situational",
  questions_for_interviewer: "Questions for the interviewer",
} as const;
export type QuestionFamily = keyof typeof questionFamilies;

export const competencies = {
  teamwork: "Teamwork",
  communication: "Communication",
  leadership: "Leadership",
  problem_solving: "Problem solving",
  adaptability: "Adaptability",
  resilience: "Resilience",
  initiative: "Initiative",
  organisation: "Organisation and prioritisation",
  commercial_awareness: "Commercial awareness",
  conflict_resolution: "Conflict and disagreement",
} as const;
export type CompetencyKey = keyof typeof competencies;

export type StoryValues = Readonly<{
  title: string;
  experienceType: ExperienceType;
  situation: string;
  task: string;
  actions: string;
  reasoning: string;
  result: string;
  reflection: string;
  summary: string | null;
  competencies: readonly CompetencyKey[];
  ready: boolean;
}>;
export type AnswerValues = Readonly<{
  questionId: string | null;
  customQuestion: string | null;
  questionFamily: QuestionFamily;
  title: string;
  keyPoints: string;
  draftAnswer: string;
  applicationId: string | null;
  recruitmentStage: string | null;
  storyIds: readonly string[];
  ready: boolean;
}>;
export type FieldErrors = Record<string, string[]>;
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const add = (e: FieldErrors, k: string, m: string) => (e[k] ??= []).push(m);
const bounded = (e: FieldErrors, k: string, v: string, max: number, required = false) => {
  if (required && !v) add(e, k, "Enter a meaningful value.");
  if (v.length > max) add(e, k, `Use ${max} characters or fewer.`);
  if (/<\/?[a-z][^>]*>/i.test(v)) add(e, k, "Do not include HTML.");
};

export function parseStory(
  input: unknown,
): { ok: true; value: StoryValues } | { ok: false; errors: FieldErrors } {
  const x = (input && typeof input === "object" ? input : {}) as Record<string, unknown>,
    e: FieldErrors = {};
  const value = {
    title: clean(x.title),
    experienceType: clean(x.experienceType) as ExperienceType,
    situation: clean(x.situation),
    task: clean(x.task),
    actions: clean(x.actions),
    reasoning: clean(x.reasoning),
    result: clean(x.result),
    reflection: clean(x.reflection),
    summary: clean(x.summary) || null,
    competencies: Array.isArray(x.competencies)
      ? [
          ...new Set(
            x.competencies.filter(
              (v): v is CompetencyKey => typeof v === "string" && v in competencies,
            ),
          ),
        ]
      : [],
    ready: x.ready === true,
  };
  bounded(e, "title", value.title, 160, true);
  if (!(value.experienceType in experienceTypes))
    add(e, "experienceType", "Choose an experience type.");
  for (const [k, max] of [
    ["situation", 3000],
    ["task", 3000],
    ["actions", 6000],
    ["reasoning", 4000],
    ["result", 4000],
    ["reflection", 4000],
  ] as const)
    bounded(e, k, value[k], max, value.ready);
  if (value.summary) bounded(e, "summary", value.summary, 1000);
  if (value.ready && !value.competencies.length)
    add(e, "competencies", "Choose at least one competency before marking Ready.");
  return Object.keys(e).length ? { ok: false, errors: e } : { ok: true, value };
}

const storyRequiredFamilies = new Set<QuestionFamily>([
  "competency_and_behavioural",
  "self_awareness",
  "situational",
]);
export function parseAnswer(
  input: unknown,
): { ok: true; value: AnswerValues } | { ok: false; errors: FieldErrors } {
  const x = (input && typeof input === "object" ? input : {}) as Record<string, unknown>,
    e: FieldErrors = {};
  const qid = clean(x.questionId),
    custom = clean(x.customQuestion),
    family = clean(x.questionFamily) as QuestionFamily;
  const storyIds = Array.isArray(x.storyIds)
    ? x.storyIds.filter((v): v is string => typeof v === "string" && uuid.test(v))
    : [];
  const value = {
    questionId: qid || null,
    customQuestion: custom || null,
    questionFamily: family,
    title: clean(x.title),
    keyPoints: clean(x.keyPoints),
    draftAnswer: clean(x.draftAnswer),
    applicationId: clean(x.applicationId) || null,
    recruitmentStage: clean(x.recruitmentStage) || null,
    storyIds,
    ready: x.ready === true,
  };
  if (Boolean(value.questionId) === Boolean(value.customQuestion))
    add(e, "question", "Choose a Core Interview Question or enter one custom question.");
  if (value.questionId && !uuid.test(value.questionId))
    add(e, "questionId", "Choose a valid question.");
  bounded(e, "customQuestion", custom, 1000);
  bounded(e, "title", value.title, 160, true);
  bounded(e, "keyPoints", value.keyPoints, 4000);
  bounded(e, "draftAnswer", value.draftAnswer, 12000, value.ready);
  if (!(family in questionFamilies)) add(e, "questionFamily", "Choose a question family.");
  if (new Set(storyIds).size !== storyIds.length)
    add(e, "storyIds", "Choose each story only once.");
  if (value.applicationId && !uuid.test(value.applicationId))
    add(e, "applicationId", "Choose a valid application.");
  if (value.ready && !value.keyPoints && !value.storyIds.length)
    add(e, "keyPoints", "Add a key point or link an evidence story before marking Ready.");
  if (value.ready && storyRequiredFamilies.has(family) && !value.storyIds.length)
    add(e, "storyIds", "Link an evidence story for this question family before marking Ready.");
  return Object.keys(e).length ? { ok: false, errors: e } : { ok: true, value };
}

export type CoverageInput = Readonly<{
  readyStories: number;
  readyAnswers: number;
  personalIntroduction: boolean;
  covered: readonly CompetencyKey[];
}>;
export function nextAction(x: CoverageInput): string {
  if (!x.personalIntroduction) return "Create your personal introduction answer.";
  if (x.readyStories === 0) return "Create and mark your first evidence story Ready.";
  if (x.readyStories < 3) return "Continue building a broader set of Ready evidence stories.";
  const important = (Object.keys(competencies) as CompetencyKey[]).find(
    (k) => !x.covered.includes(k),
  );
  if (important)
    return `Prepare an example demonstrating ${competencies[important].toLowerCase()}.`;
  return x.readyAnswers
    ? "Review and practise one of your Ready answers."
    : "Draft an answer for a question relevant to your applications.";
}
