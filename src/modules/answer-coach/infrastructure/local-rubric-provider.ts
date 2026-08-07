import type { AnswerCoachComment, AnswerCoachInput, AnswerCoachProvider } from "../domain/review";

function sentenceAnchor(answer: string, pattern?: RegExp, fallbackIndex = 0) {
  const match = pattern?.exec(answer);
  if (!match) {
    const sentences = [...answer.matchAll(/[^.!?\n]+(?:[.!?]+|(?=\n)|$)/gu)]
      .map((candidate) => {
        const raw = candidate[0];
        const leading = raw.length - raw.trimStart().length;
        const quote = raw.trim();
        const start = (candidate.index ?? 0) + leading;
        return { end: start + quote.length, quote, start };
      })
      .filter((candidate) => candidate.quote);
    if (sentences.length) return sentences[Math.min(fallbackIndex, sentences.length - 1)]!;
  }
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
    const wordCount = answer.split(/\s+/u).length;
    const competency = input.questionFamily === "competency_and_behavioural";
    const introduction = input.questionFamily === "personal_introduction";
    const motivation = input.questionFamily === "motivation_and_fit";
    const comments: AnswerCoachComment[] = [];
    const add = (comment: Omit<AnswerCoachComment, "anchor">, pattern?: RegExp) =>
      comments.push({
        ...comment,
        anchor: sentenceAnchor(answer, pattern, comments.length),
      });

    if (competency && !/\bI\b/u.test(answer))
      add(
        {
          category: "Evidence",
          observation: "Your individual contribution is not yet visible.",
          coachingQuestion: "What did you personally decide or do?",
          optionalRevision: null,
        },
        /\b(?:we|team|group)\b/iu,
      );
    if (competency && !/\b(?:because|so that|in order to|reason)\b/iu.test(answer))
      add({
        category: "Reasoning",
        observation: "The draft states actions without explaining the judgement behind them.",
        coachingQuestion: "Why did you choose this approach over the alternatives?",
        optionalRevision: null,
      });
    if (
      motivation &&
      /\b(?:prestigious|global leader|amazing culture|dream company|best company)\b/iu.test(answer)
    )
      add({
        category: "Relevance",
        observation: "The motivation sounds generic rather than specific to this opportunity.",
        coachingQuestion:
          "Which distinctive part of the organisation or role genuinely fits you, and why?",
        optionalRevision: null,
      });
    if (
      /\b(?:results-driven|exceptionally dynamic|leverage synergies|uniquely positioned|transformative impact)\b/iu.test(
        answer,
      )
    )
      add({
        category: "Relevance",
        observation: "This wording sounds over-polished and could obscure your natural voice.",
        coachingQuestion: "How would you say this to an interviewer in your own everyday words?",
        optionalRevision: null,
      });
    const tooShort = wordCount < (competency ? 55 : introduction ? 60 : 35);
    const tooLong = wordCount > (competency ? 250 : introduction ? 220 : 180);
    if (tooShort || tooLong || !/[.!?]/u.test(answer))
      add({
        category: "Structure",
        observation: tooShort
          ? "The answer is probably too short to give the assessor enough useful evidence."
          : tooLong
            ? "The answer is probably too long to deliver naturally in an interview."
            : "A clearer opening and conclusion would make this easier to follow aloud.",
        coachingQuestion: tooShort
          ? "Which one specific detail would make your answer more convincing?"
          : "What can you remove while preserving the central point?",
        optionalRevision: null,
      });
    if (
      competency &&
      !/\b(?:learn|reflect|next time|differently|realised)\b/iu.test(answer) &&
      !input.stories.some((story) => story.reflection.trim())
    )
      add({
        category: "Reflection",
        observation: "The answer does not yet show what you learned or would carry forward.",
        coachingQuestion: "What did this experience change about how you work?",
        optionalRevision: null,
      });
    if (introduction && !/\b(?:I am|I'm|I’m|im|this is my|now|currently|today)\b/iu.test(answer))
      add({
        category: "Structure",
        observation: "The introduction does not clearly establish where you are now.",
        coachingQuestion: "What is the most relevant one-sentence description of you today?",
        optionalRevision: null,
      });
    if (introduction && !/\b(?:want|next|role|opportunity|looking)\b/iu.test(answer))
      add({
        category: "Relevance",
        observation: "The introduction does not yet connect your journey to this next step.",
        coachingQuestion: "Why is this opportunity the logical next step for you?",
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
      review: {
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
        suggestedAnswer: null,
        summary:
          comments.length === 1
            ? "A strong draft with one focused improvement."
            : "Focus the next edit on specific evidence, clear reasoning and a direct response to the question.",
        unsupportedClaimsDetected: [],
      },
      usage: null,
    };
  },
};
