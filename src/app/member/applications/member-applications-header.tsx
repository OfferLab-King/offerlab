import Link from "next/link";

import { isLocalAuthBypassEnabled } from "../../../infrastructure/config/local-development";
import { SignOutButton } from "../../components/sign-out-button";
import { MemberNavLinks } from "./member-nav-links";

export function MemberApplicationsHeader() {
  const localBypass = isLocalAuthBypassEnabled();
  return (
    <header className="member-header">
      <Link className="brand" href="/member">
        OfferLab
      </Link>
      <nav aria-label="Member navigation" className="member-nav">
        <MemberNavLinks />
      </nav>
      {localBypass ? <span className="status">Local test access</span> : <SignOutButton />}
    </header>
  );
}
