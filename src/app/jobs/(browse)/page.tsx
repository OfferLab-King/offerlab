import type { Metadata } from "next";

import { searchJobCatalogFaceted } from "../../../modules/job-catalog/application/catalog";
import { parseJobCatalogFilters } from "../../../modules/job-catalog/domain/catalog";
import { currentMemberAccess } from "../../../modules/identity-access/application/authorization";
import { listSavedEmployersForMember } from "../../../modules/job-catalog/application/saved-employers";
import Link from "next/link";

import { SiteHeader } from "../../components/site-header";
import { PageHeader } from "../../components/page-header";
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
    title: "Current UK Graduate and Experienced Jobs | OfferLab",
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
  const [initialData, access] = await Promise.all([
    searchJobCatalogFaceted(filters),
    currentMemberAccess(),
  ]);
  const savedEmployers =
    access.status === "eligible"
      ? await listSavedEmployersForMember(access.authorization.userId)
      : [];
  const profile =
    access.status === "eligible"
      ? await import("../../../modules/member-profile/application/onboarding").then((m) =>
          m.readOnboardingProfile(access.authorization.userId),
        )
      : null;
  const profileIndustries = profile?.answers?.industries ?? [];
  const showProfileHint =
    access.status === "eligible" &&
    profileIndustries.length > 0 &&
    filters.industries.length === 0 &&
    !filters.query;

  return (
    <main className="catalogue-page">
      <SiteHeader />
      <div className="catalogue-shell">
        <PageHeader
          eyebrow="Roles from official employer sites"
          intro="Search current roles across leading employers, compare the details that matter, and apply directly on the employer's website. Official sources only — no recycled aggregator links."
          title="Find your next opportunity"
        />
        {showProfileHint ? (
          <p className="hint" style={{ marginTop: "-0.75rem", marginBottom: "1rem" }}>
            Based on your profile: {profileIndustries.join(", ")} —{" "}
            <Link
              href={
                `/jobs?industries=${profileIndustries.map((v) => v.replaceAll("_", "-")).join(",")}` as never
              }
            >
              filter jobs
            </Link>{" "}
            or <Link href="/employers">explore employers</Link> ·{" "}
            <Link href="/member/onboarding">update profile</Link>
          </p>
        ) : (
          <p className="hint" style={{ marginTop: "-0.75rem", marginBottom: "1rem" }}>
            Tip: <Link href="/employers">explore employers by industry</Link> then filter jobs by employer.
          </p>
        )}
        <JobCatalogueView
          initialData={initialData}
          initialUrl={initialUrl}
          savedEmployers={savedEmployers}
        />
      </div>
    </main>
  );
}
