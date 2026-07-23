import { notFound } from "next/navigation";
import { requireMember } from "../../../../../../modules/identity-access/application/authorization";
import { readStory } from "../../../../../../modules/answer-bank/application/answer-bank";
import { AnswerBankShell } from "../../shell";
import { StoryForm } from "../story-form";
export default async function Page({ params }: { params: Promise<{ storyId: string }> }) {
  const { userId } = await requireMember();
  const s = await readStory(userId, (await params).storyId);
  if (!s) notFound();
  return (
    <AnswerBankShell active="stories">
      <header className="applications-heading">
        <p className="eyebrow">Story Bank</p>
        <h1>{s.ready ? "Review" : "Edit"} evidence story</h1>
      </header>
      <StoryForm initial={s} />
    </AnswerBankShell>
  );
}
