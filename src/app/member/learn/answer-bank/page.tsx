import { requireMember } from "../../../../modules/identity-access/application/authorization";
import {
  readAnswerCoachConfiguration,
  readAnswerCoachUsage,
} from "../../../../modules/answer-coach/application/review-answer";
import {
  readAnswers,
  readQuestions,
} from "../../../../modules/answer-bank/application/answer-bank";
import { AnswerBankShell } from "./shell";
import { QuestionAnswerWorkspace } from "./question-answer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const { userId } = await requireMember();
  const answerCoachConfiguration = readAnswerCoachConfiguration();
  const [questions, answers, usage] = await Promise.all([
    readQuestions(userId),
    readAnswers(userId),
    readAnswerCoachUsage(userId),
  ]);
  return (
    <AnswerBankShell active="questions">
      <QuestionAnswerWorkspace
        answers={answers}
        configuration={answerCoachConfiguration}
        initialUsage={usage}
        questions={questions}
      />
    </AnswerBankShell>
  );
}
