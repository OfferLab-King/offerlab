import "server-only";
import { readAnswer, readStories } from "../../answer-bank/application/answer-bank";
import { localRubricProvider } from "../infrastructure/local-rubric-provider";

export async function reviewMemberAnswer(owner: string, answerId: string) {
  const [answer, stories] = await Promise.all([readAnswer(owner, answerId), readStories(owner)]);
  if (!answer || answer.archivedAt) return null;
  const linkedStories = answer.storyIds.flatMap((id) => {
    const story = stories.find((candidate) => candidate.id === id);
    return story
      ? [
          {
            actions: story.actions,
            reasoning: story.reasoning,
            reflection: story.reflection,
            result: story.result,
            situation: story.situation,
            task: story.task,
          },
        ]
      : [];
  });
  return {
    mode: localRubricProvider.mode,
    review: await localRubricProvider.review({
      draftAnswer: answer.draftAnswer,
      keyPoints: answer.keyPoints,
      question: answer.question,
      stories: linkedStories,
    }),
  } as const;
}
