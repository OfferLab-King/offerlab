import type { Metadata } from "next";
import Link from "next/link";

import {
  employerIndustryLabel,
  employeeBandRank,
  parseEmployerDirectoryFilters,
  EMPLOYER_DIRECTORY_INDUSTRIES,
  EMPLOYER_DIRECTORY_PAGE_SIZE,
} from "../../modules/job-catalog/domain/employer-directory";
import { jobSectorLabel } from "../../modules/job-catalog/domain/taxonomy";
import {
  readEmployerDirectoryEntries,
  readEmployerDirectoryOptions,
  readSectorJobCounts,
} from "../../modules/job-catalog/application/catalog";
import { SiteHeader } from "../components/site-header";

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
    alternates: { canonical: "/employers" },
    description:
      "Explore UK employers by industry, with current roles sourced from official career sites and honest zero-role states.",
    robots: filtered ? { index: false, follow: true } : undefined,
    title: "Explore UK Employers by Industry | OfferLab",
  };
}

export default async function EmployersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = parseEmployerDirectoryFilters(query);
  const [directory, sectorCounts, options] = await Promise.all([
    readEmployerDirectoryEntries(filters),
    readSectorJobCounts(),
    readEmployerDirectoryOptions(),
  ]);
  const rows = directory.rows;
  const visible = directory.hiringTotal;
  const total = directory.total;
  const pageCount = Math.max(1, Math.ceil(total / EMPLOYER_DIRECTORY_PAGE_SIZE));

  const sizeBands = [...options.employeeBands].sort(
    (a, b) => employeeBandRank(a) - employeeBandRank(b) || a.localeCompare(b),
  );
  const ownerships = options.ownerships;

  const pageLink = (page: number): string => {
    const params = new URLSearchParams();
    const set = (key: string, value: string | null): void => {
      if (value) params.set(key, value);
    };
    set("q", filters.query);
    set("industry", filters.industry);
    set("size", filters.sizeBand);
    set("ownership", filters.ownership);
    if (filters.sponsor) params.set("sponsor", "1");
    if (filters.hiring) params.set("hiring", "1");
    if (filters.sort !== "hiring") params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    return `/employers${params.size > 0 ? `?${params.toString()}` : ""}`;
  };

  return (
    <main className="employers-page">
      <SiteHeader />
      <div className="employer-directory">
        <header className="employer-directory-hero">
          <div>
            <p className="catalogue-eyebrow">Employer and industry directory</p>
            <h1>Explore UK employers</h1>
            <p className="catalogue-subtitle">
              Researched UK employers by industry. Open their current roles or official careers
              pages; employers without an open role remain discoverable for research.
            </p>
          </div>
          <p className="employer-directory-summary">
            <strong>{total}</strong> employers · {visible} hiring now
          </p>
        </header>

        <form className="employer-directory-filters" method="get" action="/employers">
          <label>
            Search
            <input name="q" defaultValue={filters.query ?? ""} placeholder="Employer name" />
          </label>
          <label>
            Industry
            <select name="industry" defaultValue={filters.industry ?? ""}>
              <option value="">All industries</option>
              {EMPLOYER_DIRECTORY_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {employerIndustryLabel(industry)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size
            <select name="size" defaultValue={filters.sizeBand ?? ""}>
              <option value="">Any size</option>
              {sizeBands.map((band) => (
                <option key={band} value={band}>
                  {band}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ownership
            <select name="ownership" defaultValue={filters.ownership ?? ""}>
              <option value="">Any ownership</option>
              {ownerships.map((ownership) => (
                <option key={ownership} value={ownership}>
                  {ownership}
                </option>
              ))}
            </select>
          </label>
          <label className="employer-directory-check">
            <input name="sponsor" type="checkbox" value="1" defaultChecked={filters.sponsor} />
            UK licensed sponsor
          </label>
          <label className="employer-directory-check">
            <input name="hiring" type="checkbox" value="1" defaultChecked={filters.hiring} />
            Hiring now
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={filters.sort}>
              <option value="hiring">Hiring first</option>
              <option value="roles">Most current roles</option>
              <option value="az">A–Z</option>
            </select>
          </label>
          <button type="submit">Apply</button>
        </form>

        {rows.length === 0 ? (
          <section className="job-catalog-empty">
            <h2>No employers match</h2>
            <p>Try removing a filter or searching for a different employer.</p>
            <Link className="button-link" href="/employers">
              Clear filters
            </Link>
          </section>
        ) : (
          <ul className="employer-directory-grid">
            {rows.map((entry) => {
              const industry = employerIndustryLabel(entry.employer_industry_key);
              const officialUrl = entry.careers_url ?? entry.website_url;
              const factParts = [
                industry ?? undefined,
                entry.employee_band ? `${entry.employee_band} employees` : undefined,
                entry.employee_scope ? `${entry.employee_scope} scope` : undefined,
              ].filter((part): part is string => part !== undefined);
              return (
                <li className="employer-directory-card" key={entry.id}>
                  <h2>
                    <Link href={`/employers/${entry.slug}`}>{entry.name}</Link>
                  </h2>
                  {factParts.length > 0 && (
                    <p className="employer-directory-facts">{factParts.join(" · ")}</p>
                  )}
                  <p className="employer-directory-roles">
                    {entry.current_jobs > 0 ? (
                      <>
                        <strong>{entry.current_jobs}</strong> current{" "}
                        {entry.current_jobs === 1 ? "role" : "roles"}
                      </>
                    ) : (
                      <>No current OfferLab roles</>
                    )}
                    {entry.has_sponsor && (
                      <span className="employer-sponsor-badge">UK licensed sponsor</span>
                    )}
                  </p>
                  <p className="employer-directory-footer">
                    {officialUrl && (
                      <a href={officialUrl} rel="noreferrer" target="_blank">
                        Official careers page →
                      </a>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {pageCount > 1 && (
          <nav className="employer-directory-pagination" aria-label="Employer directory pages">
            {filters.page > 1 ? (
              <Link className="button-link" href={pageLink(filters.page - 1) as never} rel="prev">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <p>
              Page {filters.page} of {pageCount}
            </p>
            {filters.page < pageCount ? (
              <Link className="button-link" href={pageLink(filters.page + 1) as never} rel="next">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
      <p className="hint employer-directory-sector-note">
        Sector role counts:{" "}
        {sectorCounts
          .filter((row) => row.count > 0)
          .map((row) => `${jobSectorLabel(row.sector_key) ?? row.sector_key} (${row.count})`)
          .join(" · ")}
      </p>
    </main>
  );
}
