import Link from "next/link";

import { SignOutButton } from "../../components/sign-out-button";
import { MemberNavLinks } from "./member-nav-links";

export function MemberApplicationsHeader() {
  return (
    <header className="member-header">
      <Link className="brand" href="/member">
        OfferLab
      </Link>
      <nav aria-label="Member navigation" className="member-nav">
        <MemberNavLinks />
      </nav>
      <SignOutButton />
    </header>
  );
}
