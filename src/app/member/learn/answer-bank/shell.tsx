import type { ReactNode } from "react";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { AnswerBankNavigation } from "./answer-bank-navigation";
export function AnswerBankShell({
  active,
  children,
}: {
  active: "overview" | "stories" | "answers" | "questions";
  children: ReactNode;
}) {
  return (
    <main className="applications-shell answer-bank-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="answer-bank" />
      <AnswerBankNavigation active={active} />
      {children}
    </main>
  );
}
