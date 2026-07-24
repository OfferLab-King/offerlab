import { notFound } from "next/navigation";
import { requireMember } from "../../../../../../modules/identity-access/application/authorization";
import { readApplications } from "../../../../../../modules/applications/application/applications";
import {
  readAnswer,
  readQuestions,
  readStories,
} from "../../../../../../modules/answer-bank/application/answer-bank";
import { AnswerBankShell } from "../../shell";
import { AnswerForm } from "../answer-form";
export default async function Page({ params }: { params: Promise<{ answerId: string }> }) {
  const { userId } = await requireMember(),
    id = (await params).answerId;
  const [answer, questions, stories, apps] = await Promise.all([
    readAnswer(userId, id),
    readQuestions(userId),
    readStories(userId),
    readApplications(userId),
  ]);
  if (!answer) notFound();
  return (
    <AnswerBankShell active="answers">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Answer Bank</p>
          <h1>{answer.ready ? "Review" : "Continue"} answer</h1>
        </div>
      </header>
      <AnswerForm initial={answer} questions={questions} stories={stories} applications={apps} />
    </AnswerBankShell>
  );
}
