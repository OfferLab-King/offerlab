import type { ReactNode } from "react";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
export function AnswerBankShell({
  children,
}: {
  active: "overview" | "stories" | "answers" | "questions";
  children: ReactNode;
}) {
  return (
    <main className="applications-shell answer-bank-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="answer-bank" />
      {children}
    </main>
  );
}
