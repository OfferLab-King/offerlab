import { requireAdministrator } from "../../modules/identity-access/application/authorization";
import { SignOutButton } from "../components/sign-out-button";
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
          <p>Publish learning content or review operational submissions.</p>
        </div>
        <SignOutButton />
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
      </section>
      <Link href="/member/learn">View the member workspace</Link>
    </main>
  );
}
