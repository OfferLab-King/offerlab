import Link from "next/link";

import { currentMemberAccess } from "../../modules/identity-access/application/authorization";
import { memberNavLinks, publicNavLinks } from "./site-navigation";
import { SiteNav } from "./site-nav";
import { SignOutButton } from "./sign-out-button";

type SiteHeaderProps = Readonly<{
  className?: string;
  variant?: "public" | "member";
}>;

export async function SiteHeader({ className, variant = "public" }: SiteHeaderProps) {
  let memberVariant = variant === "member";
  if (variant === "public") {
    const access = await currentMemberAccess();
    memberVariant = access.status === "eligible";
  }
  const classNames = ["site-header", className].filter(Boolean).join(" ");

  return (
    <header className={classNames}>
      <Link className="brand" href={memberVariant ? "/member" : "/"}>
        OfferLab
      </Link>
      {memberVariant ? (
        <SiteNav label="Member navigation" links={memberNavLinks} />
      ) : (
        <SiteNav label="Public navigation" links={publicNavLinks} />
      )}
      {memberVariant ? (
        <SignOutButton />
      ) : (
        <div className="site-header-actions">
          <Link href="/sign-in">Sign in</Link>
          <Link className="button-link compact-button" href="/register">
            Create free account
          </Link>
        </div>
      )}
    </header>
  );
}
