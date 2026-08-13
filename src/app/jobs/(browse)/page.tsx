import type { Metadata } from "next";

import { searchJobCatalogFaceted } from "../../../modules/job-catalog/application/catalog";
import { parseJobCatalogFilters } from "../../../modules/job-catalog/domain/catalog";
import { currentMemberAccess } from "../../../modules/identity-access/application/authorization";
import { listSavedEmployersForMember } from "../../../modules/job-catalog/application/saved-employers";
import { SiteHeader } from "../../components/site-header";
import { JobCatalogueView } from "./job-catalogue-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const filtered = Object.values(raw).some((value) =>
    Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0,
  );
  return {
    alternates: { canonical: "/jobs" },
    description:
      "Search current UK roles sourced directly from official employer career sites. Filter by sector, employer, location, job type and more.",
    robots: filtered ? { index: false, follow: true } : undefined,
    title: "Jobs at Leading Employers | OfferLab",
  };
}

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (typeof value === "string") params.set(key, value);
  }
  const filters = parseJobCatalogFilters(params);
  const initialUrl = params.toString();
  const initialData = await searchJobCatalogFaceted(filters);
  const access = await currentMemberAccess();
  const savedEmployers =
    access.status === "eligible"
      ? await listSavedEmployersForMember(access.authorization.userId)
      : [];

  return (
    <main className="catalogue-page">
      <SiteHeader />
      <div className="catalogue-shell">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">Roles from official employer sites</p>
          <h1>Find your next opportunity</h1>
          <p className="catalogue-subtitle">
            Search current roles across leading employers, compare the details that matter, and
            apply directly on the employer&apos;s website.
          </p>
          <div className="catalogue-trust-row" aria-label="About these listings">
            <span>Official employer sources</span>
            <span>Clear sector and role filters</span>
            <span>No recycled aggregator links</span>
          </div>
        </header>
        <JobCatalogueView
          initialData={initialData}
          initialUrl={initialUrl}
          savedEmployers={savedEmployers}
        />
      </div>
    </main>
  );
}
