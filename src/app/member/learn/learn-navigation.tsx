import Link from "next/link";
import type { LearnDestination } from "./learn-presenters";

const destinations = [
  { href: "/member/learn", id: "overview", label: "Overview" },
  { href: "/member/learn/paths", id: "paths", label: "Preparation Plans" },
  { href: "/member/learn/resources", id: "resources", label: "Resources" },
] as const;

export function LearnNavigation({ active }: { active: LearnDestination }) {
  return (
    <nav aria-label="Learn" className="learn-nav">
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
