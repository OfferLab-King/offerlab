import Link from "next/link";

import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readMembershipSummary } from "../../../modules/membership/application/membership";
import {
  formatPence,
  isActiveMembership,
  MEMBERSHIP_PRICING,
} from "../../../modules/membership/domain/membership";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
import { activateTestMembershipAction, cancelMembershipAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const selfServeAllowed = process.env.APP_ENV !== "production" && process.env.APP_ENV !== "staging";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function MembershipPage() {
  const authorization = await requireMember();
  const summary = await readMembershipSummary(authorization.userId);
  const active = isActiveMembership(summary);

  return (
    <main className="applications-shell dashboard-shell">
      <MemberApplicationsHeader />
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Membership</h1>
          <p className="intro">
            Membership doubles your review capacity and unlocks early access to new capabilities.
          </p>
        </div>
        <Link className="button-link secondary" href="/plans">
          View plans
        </Link>
      </header>

      <section className="card membership-card">
        <div className="membership-card-head">
          <h2>
            {active
              ? "Active membership"
              : summary.plan === "membership"
                ? "Membership"
                : "Free plan"}
          </h2>
          <span className={`status-badge ${active ? "status-badge--positive" : ""}`}>
            {active ? "Active" : summary.status === "cancelled" ? "Cancelled" : "Free"}
          </span>
        </div>
        <dl className="membership-facts">
          <div>
            <dt>Plan</dt>
            <dd>{summary.plan === "membership" ? "OfferLab Membership" : "Free"}</dd>
          </div>
          {summary.plan === "membership" && (
            <>
              <div>
                <dt>Status</dt>
                <dd>{summary.status}</dd>
              </div>
              <div>
                <dt>Period end</dt>
                <dd>{formatDate(summary.periodEnd)}</dd>
              </div>
              <div>
                <dt>Activation source</dt>
                <dd>
                  {summary.source === "test" ? "Local test activation" : (summary.source ?? "—")}
                </dd>
              </div>
            </>
          )}
        </dl>

        {active ? (
          <form action={cancelMembershipAction}>
            <button className="button-link secondary" type="submit">
              Cancel membership
            </button>
          </form>
        ) : (
          <>
            <p className="hint">
              Membership is {formatPence(MEMBERSHIP_PRICING.membershipMonthlyPence)} per month or{" "}
              {formatPence(MEMBERSHIP_PRICING.membershipSeasonPence)} for the recruitment season.
            </p>
            {selfServeAllowed ? (
              <form action={activateTestMembershipAction}>
                <button className="button-link" type="submit">
                  Activate membership
                </button>
              </form>
            ) : (
              <p className="hint">
                Membership is activated by the OfferLab team once payment is confirmed. Contact the
                team if you have already subscribed.
              </p>
            )}
          </>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="membership-benefits-title">
        <div className="section-heading">
          <div>
            <h2 id="membership-benefits-title">What membership includes</h2>
            <p>Everything on the free plan, plus the following.</p>
          </div>
        </div>
        <ul className="membership-benefits">
          <li>Double the member daily and monthly ceilings for CV and cover-letter reviews.</li>
          <li>
            Early access to new capabilities as they launch (Answer Coach, Group Mock,
            intelligence).
          </li>
          <li>Priority queue placement for practice rooms.</li>
        </ul>
      </section>
    </main>
  );
}
