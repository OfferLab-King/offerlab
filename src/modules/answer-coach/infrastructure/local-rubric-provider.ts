import {
  answerCoachReviewSchema,
  type AnswerCoachInput,
  type AnswerCoachProvider,
} from "../domain/review";

export const localRubricProvider: AnswerCoachProvider = {
  mode: "local_prototype",
  async review(input: AnswerCoachInput) {
    const strengths: { detail: string; heading: string }[] = [];
    const priorities: { detail: string; heading: string }[] = [];
    const coachingQuestions: string[] = [];
    const answer = input.draftAnswer.trim();
    const linked = input.stories;

    if (answer.length >= 350)
      strengths.push({
        detail: "The draft contains enough material for a substantive spoken answer.",
        heading: "Useful level of detail",
      });
    else
      priorities.push({
        detail:
          "Add specific evidence so the listener can understand what happened and what you contributed.",
        heading: "Develop the evidence",
      });
    if (/\bI\b/u.test(answer))
      strengths.push({
        detail: "The wording makes your individual contribution visible.",
        heading: "Personal contribution",
      });
    else
      priorities.push({
        detail:
          "Clarify your own decisions and actions rather than describing only what the group did.",
        heading: "Make your role explicit",
      });
    if (linked.length)
      strengths.push({
        detail: `The answer is grounded in ${linked.length} linked evidence ${linked.length === 1 ? "story" : "stories"}.`,
        heading: "Evidence connected",
      });
    else
      priorities.push({
        detail: "Link a relevant evidence story where this question calls for a concrete example.",
        heading: "Ground the answer",
      });
    if (linked.some((story) => !story.result.trim()))
      coachingQuestions.push(
        "What changed because of your actions, and how could you show that outcome?",
      );
    if (linked.some((story) => !story.reasoning.trim()))
      coachingQuestions.push("Why did you choose that approach over the alternatives available?");
    if (linked.some((story) => !story.reflection.trim()))
      coachingQuestions.push("What did you learn, and what would you do differently next time?");
    if (!coachingQuestions.length)
      coachingQuestions.push(
        "Which sentence most directly answers the question, and could it appear earlier?",
      );

    return answerCoachReviewSchema.parse({
      coachingQuestions: coachingQuestions.slice(0, 3),
      priorities: priorities.slice(0, 3),
      strengths: strengths.slice(0, 3),
      summary:
        priorities.length > 0
          ? "The draft has a workable base. Focus the next edit on specific evidence and your individual contribution."
          : "The draft is evidence-grounded and clear about your contribution. Tighten it around the question before practising aloud.",
    });
  },
};
