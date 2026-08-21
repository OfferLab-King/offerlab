import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "../components/site-header";
import { currentMemberAccess } from "../../modules/identity-access/application/authorization";
import { readMembershipSummary } from "../../modules/membership/application/membership";
import {
  formatPence,
  isActiveMembership,
  MEMBERSHIP_PRICING,
} from "../../modules/membership/domain/membership";
import { activateTestMembershipAction, cancelMembershipAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/plans" },
  description:
    "Start with OfferLab for free. Add monthly membership or a six-month recruitment-season pass for twice the career-document review capacity.",
  openGraph: {
    description:
      "Start with OfferLab for free. Add monthly membership or a six-month recruitment-season pass for twice the career-document review capacity.",
    title: "Plans | OfferLab",
    type: "website",
  },
  title: "Plans | OfferLab",
};

const freeBenefits = [
  "Private application, deadline and saved-role workspace",
  "Evidence and Answer Bank with curated starting questions",
  "CV and cover-letter workspace with immutable version history",
  "Official job catalogue, employer directory and preparation library",
  "A useful baseline of career-document reviews",
] as const;

const membershipBenefits = [
  "Twice the daily and monthly career-document review capacity",
  "Selected new capabilities as they become available",
  "The complete free workspace, with the same privacy protections",
] as const;

const selfServeAllowed = process.env.APP_ENV !== "production" && process.env.APP_ENV !== "staging";

function formatDate(value: Date | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function PlanBenefits({ benefits }: Readonly<{ benefits: readonly string[] }>) {
  return (
    <ul className="plan-benefits">
      {benefits.map((benefit) => (
        <li key={benefit}>{benefit}</li>
      ))}
    </ul>
  );
}

export default async function PlansPage() {
  const access = await currentMemberAccess();
  let memberSummary = null;
  if (access.status === "eligible") {
    memberSummary = await readMembershipSummary(access.authorization.userId);
  }
  const isMember = memberSummary !== null && isActiveMembership(memberSummary);
  const freeHref = access.status === "eligible" ? "/member" : "/register";

  return (
    <>
      <SiteHeader />
      <main className="marketing-main plans-page">
        <section className="plans-hero">
          <p className="eyebrow">Simple, honest membership</p>
          <h1>Build for free. Add more review capacity when it matters.</h1>
          <p className="marketing-lead">
            Every core preparation tool remains useful without payment. Membership is for the weeks
            when several serious applications need focused document feedback at once.
          </p>
          <div className="plans-assurance-row" aria-label="Membership assurances">
            <span>No card on the free plan</span>
            <span>Tax-inclusive GBP pricing</span>
            <span>Your records stay private</span>
          </div>
        </section>

        {memberSummary ? (
          <section className="plans-current-plan" id="your-plan" aria-labelledby="your-plan-title">
            <div>
              <p className="eyebrow">Your plan</p>
              <h2 id="your-plan-title">{isMember ? "OfferLab Membership" : "Free plan"}</h2>
              <p>
                {isMember
                  ? "Your additional career-document review capacity is active."
                  : memberSummary.status === "cancelled"
                    ? "Your previous membership has ended. Your workspace continues on the free plan."
                    : "Your complete core workspace is active with no artificial expiry."}
              </p>
            </div>
            <div className="plans-current-plan__management">
              <span className={`status-badge ${isMember ? "status-badge--positive" : ""}`}>
                {isMember ? "Active" : "Current plan"}
              </span>
              {isMember ? (
                <>
                  <p className="plans-current-plan__date">
                    Current period ends <strong>{formatDate(memberSummary.periodEnd)}</strong>
                  </p>
                  <form action={cancelMembershipAction}>
                    <button className="button-link secondary" type="submit">
                      Cancel membership
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="plans-grid plans-grid--three" aria-label="OfferLab plans">
          <article className="plan-card plan-card--free">
            <div className="plan-card-heading">
              {memberSummary && !isMember ? <span className="status-badge">Current</span> : null}
              <p className="eyebrow">Start here</p>
              <h2>Free</h2>
            </div>
            <p className="plan-price">£0</p>
            <p className="plan-price-note">No card required. No artificial expiry.</p>
            <PlanBenefits benefits={freeBenefits} />
            <Link className="button-link secondary" href={freeHref}>
              {access.status === "eligible" ? "Open workspace" : "Create free account"}
            </Link>
          </article>

          <article className="plan-card plan-card-featured">
            <div className="plan-card-heading">
              <span className="status-badge">Flexible</span>
              <p className="eyebrow">Monthly membership</p>
              <h2>Monthly</h2>
            </div>
            <p className="plan-price">{formatPence(MEMBERSHIP_PRICING.membershipMonthlyPence)}</p>
            <p className="plan-price-note">per month · renews monthly until cancelled</p>
            <PlanBenefits benefits={membershipBenefits} />
            {access.status !== "eligible" ? (
              <Link className="button-link" href="/register">
                Choose monthly
              </Link>
            ) : isMember ? (
              <span className="plan-card-current">Included in your active membership</span>
            ) : selfServeAllowed ? (
              <form action={activateTestMembershipAction} className="plan-card-action">
                <button className="button-link" type="submit">
                  Activate membership locally
                </button>
              </form>
            ) : (
              <p className="plan-card-availability">Contact OfferLab to activate this plan.</p>
            )}
          </article>

          <article className="plan-card plan-card--season">
            <div className="plan-card-heading">
              <p className="eyebrow">One focused season</p>
              <h2>Six months</h2>
            </div>
            <p className="plan-price">{formatPence(MEMBERSHIP_PRICING.membershipSeasonPence)}</p>
            <p className="plan-price-note">one payment · does not renew automatically</p>
            <PlanBenefits benefits={membershipBenefits} />
            {access.status !== "eligible" ? (
              <Link className="button-link secondary" href="/register">
                Choose six months
              </Link>
            ) : isMember ? (
              <span className="plan-card-current">Included in your active membership</span>
            ) : selfServeAllowed ? (
              <form action={activateTestMembershipAction} className="plan-card-action">
                <button className="button-link secondary" type="submit">
                  Activate membership locally
                </button>
              </form>
            ) : (
              <p className="plan-card-availability">Contact OfferLab to activate this plan.</p>
            )}
          </article>
        </section>

        <section className="plans-value-section">
          <div className="plans-value-intro">
            <p className="eyebrow">What changes when you join</p>
            <h2>The same trusted workspace. More room for important reviews.</h2>
            <p>
              Membership never changes who owns your applications, documents or answers. It raises
              your career-document review ceiling and may include access to explicitly labelled
              selected new capabilities as they become available.
            </p>
          </div>
          <dl className="plans-comparison">
            <div>
              <dt>Core preparation workspace</dt>
              <dd>Included on Free and Membership</dd>
            </div>
            <div>
              <dt>Career-document review capacity</dt>
              <dd>2× the free member limits</dd>
            </div>
            <div>
              <dt>New capabilities</dt>
              <dd>Included when they are ready for members to use</dd>
            </div>
            <div>
              <dt>Group Mock waitlists</dt>
              <dd>Fair first-in order for every eligible member</dd>
            </div>
          </dl>
        </section>

        <section className="home-final-cta plans-final-cta">
          <p className="eyebrow">Begin with the work in front of you</p>
          <h2>Your first useful artefact should cost nothing.</h2>
          <p>
            Create an application, save a role or build your first evidence story. Upgrade only when
            the additional review capacity has a clear job to do.
          </p>
          <div className="marketing-actions">
            <Link className="button-link home-primary-action" href={freeHref}>
              {access.status === "eligible"
                ? "Return to your workspace"
                : "Create your free account"}
            </Link>
            <Link className="home-text-action" href="/jobs">
              Browse current roles
            </Link>
          </div>
        </section>

        <footer className="home-footer">
          <div>
            <Link className="brand" href="/">
              <span aria-hidden="true" className="brand__mark" />
              <span className="brand__word">OfferLab</span>
            </Link>
            <p>Evidence-led preparation for UK graduate recruitment.</p>
          </div>
          <nav aria-label="Explore OfferLab">
            <Link href="/jobs">Jobs</Link>
            <Link href="/employers">Employers</Link>
            <Link href="/intelligence">Intelligence</Link>
          </nav>
          <nav aria-label="Your OfferLab account">
            <Link href="/register">Create account</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/member">Workspace</Link>
          </nav>
          <p className="home-footer-note">
            Clear pricing. Honest availability. No outcome promises.
          </p>
        </footer>
      </main>
    </>
  );
}
