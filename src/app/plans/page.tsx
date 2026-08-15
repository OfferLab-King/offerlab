import Link from "next/link";

import { SiteHeader } from "../components/site-header";
import { currentMemberAccess } from "../../modules/identity-access/application/authorization";
import { readMembershipSummary } from "../../modules/membership/application/membership";
import {
  formatPence,
  isActiveMembership,
  MEMBERSHIP_PRICING,
} from "../../modules/membership/domain/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freeBenefits = [
  "Private workspace for applications, deadlines and saved roles",
  "Evidence and Answer Bank with curated starting questions",
  "CV and cover-letter workspace with version history",
  "Official job catalogue and employer directory",
  "Preparation resources, plans and recommendations",
] as const;

const membershipBenefits = [
  "Double the member review capacity for CV and cover-letter feedback",
  "Early access to new capabilities as they launch",
  "Priority queue placement for practice rooms",
  "Support the direction of OfferLab's development",
] as const;

export default async function PlansPage() {
  const access = await currentMemberAccess();
  let memberSummary = null;
  if (access.status === "eligible") {
    memberSummary = await readMembershipSummary(access.authorization.userId);
  }
  const isMember = memberSummary !== null && isActiveMembership(memberSummary);

  return (
    <>
      <SiteHeader />
      <main className="marketing-main">
        <section className="plans-hero">
          <p className="eyebrow">OfferLab Membership</p>
          <h1>Keep every application moving with structure you can trust</h1>
          <p className="marketing-lead">
            OfferLab stays free to use for preparation and organisation. Membership raises your
            review capacity and funds the judgement, practice and intelligence the free plan cannot
            carry.
          </p>
        </section>

        <section className="plans-grid" aria-label="OfferLab plans">
          <article className="plan-card">
            <h2>Free</h2>
            <p className="plan-price">£0</p>
            <p className="plan-price-note">forever, no card required</p>
            <ul className="plan-benefits">
              {freeBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <Link
              className="button-link"
              href={access.status === "eligible" ? "/member" : "/register"}
            >
              {access.status === "eligible" ? "Open your workspace" : "Create free account"}
            </Link>
          </article>

          <article className="plan-card plan-card-featured">
            <span className="status-badge">Recommended</span>
            <h2>Membership</h2>
            <p className="plan-price">{formatPence(MEMBERSHIP_PRICING.membershipMonthlyPence)}</p>
            <p className="plan-price-note">
              per month, or {formatPence(MEMBERSHIP_PRICING.membershipSeasonPence)} for the
              recruitment season
            </p>
            <ul className="plan-benefits">
              {membershipBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            {isMember ? (
              <Link className="button-link" href="/member/membership">
                Manage your membership
              </Link>
            ) : access.status === "eligible" ? (
              <Link className="button-link" href="/member/membership">
                Get membership
              </Link>
            ) : (
              <Link className="button-link" href="/register">
                Create account to get membership
              </Link>
            )}
          </article>
        </section>

        <section className="marketing-section">
          <div className="section-introduction">
            <p className="eyebrow">Honest availability</p>
            <h2>What you pay for is clearly labelled</h2>
            <p>
              The free plan keeps every approved preparation capability available. Membership adds
              capacity and early access; it never hides what was already free.
            </p>
          </div>
          <div className="marketing-card-grid">
            <article className="marketing-feature-card">
              <p className="eyebrow">Review capacity</p>
              <h3>2× member review limits</h3>
              <p>
                Membership doubles the member daily and monthly ceilings for career-document
                feedback, so your most important applications are never blocked by a limit.
              </p>
            </article>
            <article className="marketing-feature-card">
              <p className="eyebrow">Early access</p>
              <h3>New capabilities first</h3>
              <p>
                Members see and shape Answer Coach, Group Mock and intelligence improvements as they
                are validated.
              </p>
            </article>
            <article className="marketing-feature-card">
              <p className="eyebrow">Privacy</p>
              <h3>Your records stay yours</h3>
              <p>
                Membership changes nothing about ownership: applications, documents and answers
                remain private, member-owned records with the same protections.
              </p>
            </article>
          </div>
        </section>

        <section className="marketing-cta">
          <div>
            <p className="eyebrow">Start free</p>
            <h2>Begin with what you already have, upgrade when it matters.</h2>
            <p>Create your free account and build your first evidence story today.</p>
          </div>
          <Link className="button-link marketing-primary-action" href="/register">
            Create your free account
          </Link>
        </section>

        <footer className="marketing-footer">
          <Link className="brand" href="/">
            OfferLab
          </Link>
          <p>Practical preparation for UK graduate recruitment.</p>
          <Link href="/intelligence">Recruitment Intelligence</Link>
          <Link href="/member">Open workspace</Link>
          <Link href="/plans">Plans</Link>
        </footer>
      </main>
    </>
  );
}
