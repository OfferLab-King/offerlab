import Link from "next/link";
const links = [
  ["overview", "/member/learn/answer-bank", "Overview"],
  ["stories", "/member/learn/answer-bank/stories", "Stories"],
  ["answers", "/member/learn/answer-bank/answers", "Answers"],
  ["questions", "/member/learn/answer-bank/questions", "Questions"],
] as const;
export function AnswerBankNavigation({ active }: { active: (typeof links)[number][0] }) {
  return (
    <nav aria-label="My Answer and Story Bank" className="answer-bank-nav">
      {links.map(([id, href, label]) => (
        <Link aria-current={active === id ? "page" : undefined} href={href} key={id}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
