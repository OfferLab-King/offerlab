import Link from "next/link";

import { currentMemberAccess } from "../../modules/identity-access/application/authorization";
import { isLocalAuthBypassEnabled } from "../../infrastructure/config/local-development";
import { memberAccountLinks, memberNavLinks, publicNavLinks } from "./site-navigation";
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
  const localBypass = isLocalAuthBypassEnabled();
  const classNames = ["site-header", className].filter(Boolean).join(" ");

  return (
    <header className={classNames}>
      <div className="site-header__inner">
        <Link className="brand" href={memberVariant ? "/member" : "/"} aria-label="OfferLab home">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__word">OfferLab</span>
        </Link>
        {memberVariant ? (
          <SiteNav label="Member navigation" links={memberNavLinks} />
        ) : (
          <SiteNav label="Public navigation" links={publicNavLinks} />
        )}
        {memberVariant ? (
          localBypass ? (
            <span className="status">Local test access</span>
          ) : (
            <div className="site-header-actions">
              <nav aria-label="Account" className="site-account-nav">
                {memberAccountLinks.map((link) => (
                  <Link href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <SignOutButton />
            </div>
          )
        ) : (
          <div className="site-header-actions">
            <Link className="site-header__link" href="/sign-in">
              Sign in
            </Link>
            <Link className="button-link site-header__cta" href="/register">
              Create free account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
