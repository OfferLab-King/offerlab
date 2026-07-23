import { AnswerBankShell } from "../../shell";
import { StoryForm } from "../story-form";
export default function Page() {
  return (
    <AnswerBankShell active="stories">
      <header className="applications-heading">
        <p className="eyebrow">Story Bank</p>
        <h1>Add an evidence story</h1>
      </header>
      <StoryForm />
    </AnswerBankShell>
  );
}
