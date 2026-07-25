import type { AnswerCoachComment, AnswerCoachInput, AnswerCoachProvider } from "../domain/review";

function sentenceAnchor(answer: string, pattern?: RegExp) {
  const match = pattern?.exec(answer);
  const start = match?.index ?? 0;
  const boundary = answer.indexOf(".", start);
  const end = Math.min(
    answer.length,
    boundary < 0 ? Math.max(start + 1, answer.length) : boundary + 1,
  );
  return { end, quote: answer.slice(start, end), start };
}

export const localRubricProvider: AnswerCoachProvider = {
  id: "local-rubric-v1",
  mode: "local_rubric",
  async review(input: AnswerCoachInput) {
    const answer = input.draftAnswer.trim();
    const comments: AnswerCoachComment[] = [];
    const add = (comment: Omit<AnswerCoachComment, "anchor">, pattern?: RegExp) =>
      comments.push({ ...comment, anchor: sentenceAnchor(answer, pattern) });

    if (!/\bI\b/u.test(answer))
      add(
        {
          category: "Evidence",
          observation: "Your individual contribution is not yet visible.",
          coachingQuestion: "What did you personally decide or do?",
          optionalRevision: null,
        },
        /\b(?:we|team|group)\b/iu,
      );
    if (!/\b(?:because|so that|in order to|reason)\b/iu.test(answer))
      add({
        category: "Reasoning",
        observation: "The draft states actions without explaining the judgement behind them.",
        coachingQuestion: "Why did you choose this approach over the alternatives?",
        optionalRevision: null,
      });
    if (
      !input.question ||
      !answer.toLocaleLowerCase().includes(
        input.question
          .split(/\s+/u)
          .find((word) => word.length > 6)
          ?.toLocaleLowerCase() ?? "__none__",
      )
    )
      add({
        category: "Relevance",
        observation: "The link to the question could be more explicit.",
        coachingQuestion: "Which sentence most directly answers the question?",
        optionalRevision: null,
      });
    if (answer.length > 550 || !/[.!?]/u.test(answer))
      add({
        category: "Structure",
        observation:
          "A clearer opening, evidence sequence and conclusion would make this easier to follow aloud.",
        coachingQuestion: "What is the one point the listener should hear first?",
        optionalRevision: null,
      });
    if (
      !/\b(?:learn|reflect|next time|differently|realised)\b/iu.test(answer) &&
      !input.stories.some((story) => story.reflection.trim())
    )
      add({
        category: "Reflection",
        observation: "The answer does not yet show what you learned or would carry forward.",
        coachingQuestion: "What did this experience change about how you work?",
        optionalRevision: null,
      });
    if (!comments.length)
      add({
        category: "Structure",
        observation:
          "The answer is well grounded; the opening can still make the central point faster.",
        coachingQuestion: "Could your strongest result or decision appear in the first sentence?",
        optionalRevision: null,
      });

    return {
      comments: comments.slice(0, 5),
      followUpQuestions: comments.slice(0, 3).map((item) => item.coachingQuestion),
      strengths: [
        input.stories.length
          ? `Grounded in ${input.stories.length} selected evidence ${input.stories.length === 1 ? "story" : "stories"}.`
          : "The existing draft gives you a concrete starting point.",
        /\bI\b/u.test(answer)
          ? "Your first-person wording helps make ownership clear."
          : "The draft preserves your own wording and facts.",
      ],
      summary:
        comments.length === 1
          ? "A strong draft with one focused improvement."
          : "Focus the next edit on specific evidence, clear reasoning and a direct response to the question.",
      unsupportedClaimsDetected: [],
    };
  },
};
