import { requireMember } from "../../../../../../modules/identity-access/application/authorization";
import { readApplications } from "../../../../../../modules/applications/application/applications";
import {
  readQuestions,
  readStories,
} from "../../../../../../modules/answer-bank/application/answer-bank";
import { AnswerBankShell } from "../../shell";
import { AnswerForm } from "../answer-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const { userId } = await requireMember();
  const [questions, stories, apps] = await Promise.all([
    readQuestions(userId),
    readStories(userId),
    readApplications(userId),
  ]);
  return (
    <AnswerBankShell active="answers">
      <header className="applications-heading">
        <p className="eyebrow">Answer Bank</p>
        <h1>Draft an answer</h1>
      </header>
      <AnswerForm
        questions={questions}
        stories={stories}
        applications={apps}
        {...((await searchParams).question
          ? { selectedQuestion: (await searchParams).question }
          : {})}
      />
    </AnswerBankShell>
  );
}
