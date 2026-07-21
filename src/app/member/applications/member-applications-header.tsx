import Link from "next/link";

import { SignOutButton } from "../../components/sign-out-button";

export function MemberApplicationsHeader() {
  return (
    <header className="member-header">
      <Link className="brand" href="/member">
        OfferLab
      </Link>
      <nav aria-label="Member navigation" className="member-nav">
        <Link href="/member">Home</Link>
        <Link href="/member/applications">Applications</Link>
        <Link href="/member/onboarding">Profile</Link>
        <SignOutButton />
      </nav>
    </header>
  );
}
