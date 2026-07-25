import Link from "next/link";
import type { LearnDestination } from "./learn-presenters";

const destinations = [
  { href: "/member/learn", id: "overview", label: "Overview" },
  { href: "/member/learn/answer-bank", id: "answer-bank", label: "Answer Bank" },
  { href: "/member/learn/cases", id: "cases", label: "Coaching Cases" },
  { href: "/member/learn/practice", id: "practice", label: "Practice & Feedback" },
  { href: "/member/learn/intelligence", id: "intelligence", label: "Intelligence" },
  { href: "/member/learn/paths", id: "paths", label: "Preparation Plans" },
  { href: "/member/learn/resources", id: "resources", label: "Resources" },
] as const;

export function LearnNavigation({ active }: { active: LearnDestination }) {
  return (
    <nav aria-label="Prepare" className="learn-nav">
      {destinations.map((destination) => (
        <Link
          aria-current={active === destination.id ? "page" : undefined}
          href={destination.href}
          key={destination.id}
        >
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}
