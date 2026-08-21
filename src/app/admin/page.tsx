import { requireAdministrator } from "../../modules/identity-access/application/authorization";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdministratorPage() {
  await requireAdministrator();
  return (
    <main className="cms-page admin-home">
      <header className="cms-page-header admin-home-header">
        <div>
          <p className="eyebrow">OfferLab administration</p>
          <h1>What would you like to manage?</h1>
          <p>Go directly to the operational area that needs attention.</p>
        </div>
      </header>
      <section className="admin-home-grid">
        <Link className="admin-home-card" href="/admin/content">
          <span className="admin-home-icon">C</span>
          <div>
            <h2>Content management</h2>
            <p>
              Create resources, annotated coaching cases, categories, tags and preparation paths.
            </p>
            <strong>Open CMS →</strong>
          </div>
        </Link>
        <Link className="admin-home-card" href="/admin/intelligence">
          <span className="admin-home-icon">I</span>
          <div>
            <h2>Recruitment Intelligence</h2>
            <p>Create coach-curated reports and moderate confidential member submissions.</p>
            <strong>Manage reports →</strong>
          </div>
        </Link>
        <Link className="admin-home-card" href="/admin/operations">
          <span className="admin-home-icon">O</span>
          <div>
            <h2>Operations</h2>
            <p>Manage availability and requests for manually operated practice services.</p>
            <strong>Open operations →</strong>
          </div>
        </Link>
        <Link className="admin-home-card" href="/admin/job-sources">
          <span className="admin-home-icon">J</span>
          <div>
            <h2>Job catalogue</h2>
            <p>Monitor sources, review eligibility and publication decisions, and inspect runs.</p>
            <strong>Manage sources →</strong>
          </div>
        </Link>
        <Link className="admin-home-card" href="/admin/employers">
          <span className="admin-home-icon">E</span>
          <div>
            <h2>Employer research</h2>
            <p>Review employer coverage, sponsor evidence, aliases and source readiness.</p>
            <strong>Open research →</strong>
          </div>
        </Link>
        <Link className="admin-home-card" href="/admin/membership">
          <span className="admin-home-icon">M</span>
          <div>
            <h2>Memberships</h2>
            <p>Inspect active and historical paid entitlements in one read-only view.</p>
            <strong>View memberships →</strong>
          </div>
        </Link>
      </section>
    </main>
  );
}
