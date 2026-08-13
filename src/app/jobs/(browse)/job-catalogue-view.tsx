"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { FacetedSearchPayload } from "../../../modules/job-catalog/application/catalog";
import {
  activeFilterCount,
  defaultJobCatalogFilters,
  jobCatalogSortLabels,
  parseJobCatalogFilters,
  serializeJobCatalogFilters,
  type CatalogFacetGroup,
  type JobCatalogFilters,
  type JobCatalogSort,
} from "../../../modules/job-catalog/domain/catalog";
import { JobCard } from "../job-card";
import { FacetSidebar } from "./facet-sidebar";

const SEARCH_DEBOUNCE_MS = 350;

type ActiveChip = Readonly<{
  group: CatalogFacetGroup | "deadline" | "posted" | "sort";
  label: string;
  value: string;
}>;

function buildChips(filters: JobCatalogFilters): readonly ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const value of filters.sectors) {
    chips.push({ group: "sectors", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.subsectors) {
    chips.push({ group: "subsectors", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.industries) {
    chips.push({ group: "industries", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.functions) {
    chips.push({ group: "functions", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.levels) {
    chips.push({ group: "levels", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.employers) {
    chips.push({ group: "employers", label: value, value });
  }
  for (const value of filters.locations) {
    chips.push({ group: "locations", label: value, value });
  }
  for (const value of filters.workModes) {
    chips.push({ group: "workModes", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.jobTypes) {
    chips.push({ group: "jobTypes", label: value.replaceAll("_", " "), value });
  }
  for (const value of filters.sponsorship) {
    chips.push({ group: "sponsorship", label: value.replaceAll("_", " "), value });
  }
  if (filters.sponsorLicence) {
    chips.push({ group: "sponsorLicence", label: "Employer is a UK licensed sponsor", value: "1" });
  }
  if (filters.deadline !== "any") {
    chips.push({
      group: "deadline",
      label: `Deadline: ${filters.deadline}`,
      value: filters.deadline,
    });
  }
  if (filters.postedWithinDays) {
    chips.push({
      group: "posted",
      label: `Posted: ${filters.postedWithinDays} days`,
      value: String(filters.postedWithinDays),
    });
  }
  if (filters.sort !== "newest") {
    chips.push({ group: "sort", label: `Sort: ${filters.sort}`, value: filters.sort });
  }
  return chips;
}

function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function JobCatalogueView({
  initialData,
  initialUrl,
  savedEmployers = [],
}: Readonly<{
  initialData: FacetedSearchPayload;
  initialUrl: string;
  savedEmployers?: readonly { slug: string; name: string }[];
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();

  const filters = useMemo(() => parseJobCatalogFilters(searchParams), [searchParams]);
  const [data, setData] = useState<FacetedSearchPayload>(initialData);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.query);
  const [locationInput, setLocationInput] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const lastFetchedUrl = useRef(initialUrl);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (urlKey === lastFetchedUrl.current && retryNonce === 0) return;
    lastFetchedUrl.current = urlKey;
    setPendingUrl(urlKey);
    setFailed(false);
    void fetch(`/api/jobs/search?${urlKey}`)
      .then((response) => {
        if (!response.ok) throw new Error("search failed");
        return response.json() as Promise<FacetedSearchPayload>;
      })
      .then((payload) => {
        setData(payload);
      })
      .catch(() => setFailed(true))
      .finally(() => setPendingUrl(null));
  }, [retryNonce, urlKey]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  useEffect(() => {
    if (drawerOpen) {
      const previous = document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
      document.body.style.overflow = "hidden";
      const closeOnEscape = (event: KeyboardEvent): void => {
        if (event.key === "Escape") setDrawerOpen(false);
      };
      document.addEventListener("keydown", closeOnEscape);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", closeOnEscape);
        previous?.focus();
      };
    }
    return undefined;
  }, [drawerOpen]);

  const commit = useCallback(
    (next: JobCatalogFilters) => {
      const params = serializeJobCatalogFilters(next);
      const nextUrl = params.toString();
      if (nextUrl === searchParams.toString()) return;
      router.replace((nextUrl ? `${pathname}?${nextUrl}` : pathname) as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const updateFacet = useCallback(
    (group: CatalogFacetGroup | "deadline" | "posted" | "sort", value: string) => {
      if (group === "deadline") {
        commit({ ...filters, deadline: value as JobCatalogFilters["deadline"], page: 1 });
        return;
      }
      if (group === "posted") {
        commit({
          ...filters,
          page: 1,
          postedWithinDays: value === "" ? null : Number(value),
        });
        return;
      }
      if (group === "sort") {
        commit({ ...filters, page: 1, sort: value as JobCatalogSort });
        return;
      }
      const key = group as CatalogFacetGroup;
      if (key === "sponsorLicence") {
        commit({ ...filters, page: 1, sponsorLicence: !filters.sponsorLicence });
        return;
      }
      commit({ ...filters, [key]: toggleValue(filters[key] as readonly string[], value), page: 1 });
    },
    [commit, filters],
  );

  const clearGroup = useCallback(
    (group: CatalogFacetGroup | "deadline" | "posted" | "sort") => {
      if (group === "deadline") {
        commit({ ...filters, deadline: "any", page: 1 });
        return;
      }
      if (group === "posted") {
        commit({ ...filters, page: 1, postedWithinDays: null });
        return;
      }
      if (group === "sort") {
        commit({ ...filters, page: 1, sort: "newest" });
        return;
      }
      const key = group as CatalogFacetGroup;
      if (key === "sponsorLicence") {
        commit({ ...filters, page: 1, sponsorLicence: false });
        return;
      }
      commit({ ...filters, [key]: [], page: 1 });
    },
    [commit, filters],
  );

  const clearAll = useCallback(() => {
    setSearchInput("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ ...defaultJobCatalogFilters });
  }, [commit]);

  const updateQuery = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit({ ...filters, page: 1, query: value.trim() });
      }, SEARCH_DEBOUNCE_MS);
    },
    [commit, filters],
  );

  const setQuickFilter = useCallback(
    (next: JobCatalogFilters) => {
      setSearchInput(next.query);
      commit({ ...next, page: 1 });
    },
    [commit],
  );

  const goToPage = useCallback(
    (page: number) => {
      commit({ ...filters, page });
    },
    [commit, filters],
  );

  const chips = useMemo(() => buildChips(filters), [filters]);
  const facetCount = activeFilterCount(filters);
  const fetching = pendingUrl !== null;
  const total = data.result.total;
  const chipsVisible = chips.length > 0;

  const quickChips: ReadonlyArray<{ label: string; filters: JobCatalogFilters }> = [
    ...savedEmployers.map((employer) => ({
      filters: { ...defaultJobCatalogFilters, employers: [employer.slug] },
      label: `Saved: ${employer.name}`,
    })),
    {
      filters: { ...defaultJobCatalogFilters, jobTypes: ["graduate_job", "graduate_scheme"] },
      label: "Graduate jobs",
    },
    { filters: { ...defaultJobCatalogFilters, jobTypes: ["internship"] }, label: "Internships" },
    { filters: { ...defaultJobCatalogFilters, locations: ["london"] }, label: "London" },
    { filters: { ...defaultJobCatalogFilters, locations: ["remote"] }, label: "Remote" },
    {
      filters: { ...defaultJobCatalogFilters, deadline: "upcoming", sort: "closing" },
      label: "Closing soon",
    },
  ];

  const applyLocation = (): void => {
    const value = locationInput.trim().toLowerCase();
    if (!value) return;
    setLocationInput("");
    commit({ ...filters, locations: toggleValue(filters.locations, value), page: 1 });
  };

  return (
    <div className="catalogue-layout">
      <form
        className="catalogue-search"
        onSubmit={(event) => {
          event.preventDefault();
          applyLocation();
        }}
        role="search"
      >
        <label className="catalogue-search-field">
          <svg
            aria-hidden="true"
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="catalogue-search-control">
            <span className="catalogue-search-label">Keywords</span>
            <input
              onChange={(event) => updateQuery(event.currentTarget.value)}
              placeholder="Role, skill or employer"
              type="search"
              value={searchInput}
            />
          </span>
        </label>
        <label className="catalogue-search-field">
          <svg
            aria-hidden="true"
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="catalogue-search-control">
            <span className="catalogue-search-label">Location</span>
            <input
              list="catalogue-location-options"
              onChange={(event) => setLocationInput(event.currentTarget.value)}
              placeholder="City, region or remote"
              type="search"
              value={locationInput}
            />
          </span>
          <datalist id="catalogue-location-options">
            {data.facets.locations.slice(0, 50).map((location) => (
              <option key={location.value} value={location.label} />
            ))}
          </datalist>
        </label>
        <button className="button-link" type="submit">
          Find jobs
        </button>
      </form>

      <div className="catalogue-discovery-row">
        <span>Popular</span>
        <div className="catalogue-quick-chips" role="group" aria-label="Quick filters">
          {quickChips.map((chip) => {
            const active =
              serializeJobCatalogFilters(chip.filters).toString() ===
              serializeJobCatalogFilters(filters).toString();
            return (
              <button
                aria-pressed={active}
                className={`catalogue-quick-chip ${active ? "is-active" : ""}`}
                key={chip.label}
                onClick={() => setQuickFilter(chip.filters)}
                type="button"
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <Link className="catalogue-browse-sectors" href="/employers">
          Browse employers by sector <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="catalogue-sidebar-column">
        <FacetSidebar
          facets={data.facets}
          filters={filters}
          onClearAll={clearAll}
          onClearGroup={(group) => clearGroup(group)}
          onToggle={(group, value) => updateFacet(group, value)}
        />
      </div>

      <div className="catalogue-results-column">
        <div className="catalogue-toolbar">
          <button
            className="button-link secondary catalogue-filters-button"
            onClick={() => setDrawerOpen(true)}
            type="button"
          >
            Filters{facetCount > 0 ? ` (${facetCount})` : ""}
          </button>
          <div className="catalogue-results-title">
            <h2>Latest opportunities</h2>
            <p aria-live="polite" className="catalogue-count" role="status">
              {fetching
                ? "Updating results…"
                : `${total} ${total === 1 ? "role" : "roles"} available`}
            </p>
          </div>
          <label className="catalogue-sort">
            <span className="visually-hidden">Sort results</span>
            <select
              onChange={(event) => updateFacet("sort", event.currentTarget.value)}
              value={filters.sort}
            >
              {(Object.entries(jobCatalogSortLabels) as Array<[JobCatalogSort, string]>).map(
                ([value, label]) => (
                  <option
                    disabled={value === "salary" && !data.hasSalaryData}
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        {chipsVisible && (
          <ul className="catalogue-active-chips" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={`${chip.group}-${chip.value}`}>
                <button
                  onClick={() => {
                    if (
                      chip.group === "deadline" ||
                      chip.group === "posted" ||
                      chip.group === "sort"
                    ) {
                      clearGroup(chip.group);
                    } else {
                      updateFacet(chip.group, chip.value);
                    }
                  }}
                  type="button"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
            <li>
              <button className="catalogue-chip-clear-all" onClick={clearAll} type="button">
                Clear all
              </button>
            </li>
          </ul>
        )}

        {failed ? (
          <section className="job-catalog-error" role="alert">
            <h2>The catalogue could not be loaded</h2>
            <p>Something went wrong while looking up the latest roles. Try again.</p>
            <button
              className="button-link"
              onClick={() => setRetryNonce((nonce) => nonce + 1)}
              type="button"
            >
              Retry
            </button>
          </section>
        ) : fetching ? (
          <div className="job-catalog-loading" aria-busy="true" aria-label="Loading jobs">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="job-card job-card-skeleton" key={index} />
            ))}
          </div>
        ) : data.result.total === 0 ? (
          <section className="job-catalog-empty" aria-live="polite">
            <h2>No jobs match those filters</h2>
            <p>
              Try removing a filter or searching a broader term. OfferLab only shows roles that are
              currently open on employer career sites.
            </p>
            <button className="button-link" onClick={clearAll} type="button">
              Clear all filters
            </button>
          </section>
        ) : (
          <>
            <section className="public-jobs-results" aria-label="Job results">
              {data.result.items.map((job) => (
                <JobCard job={job} key={job.id} now={new Date()} />
              ))}
            </section>
            {data.result.pageCount > 1 && (
              <nav aria-label="Pagination" className="job-catalog-pagination">
                {filters.page > 1 && (
                  <button onClick={() => goToPage(filters.page - 1)} type="button">
                    Previous
                  </button>
                )}
                <span>
                  Page {filters.page} of {data.result.pageCount}
                </span>
                {filters.page < data.result.pageCount && (
                  <button onClick={() => goToPage(filters.page + 1)} type="button">
                    Next
                  </button>
                )}
              </nav>
            )}
          </>
        )}
      </div>

      {drawerOpen && (
        <div
          className="catalogue-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        />
      )}
      <aside
        aria-hidden={!drawerOpen}
        aria-label="Filters"
        className={`catalogue-drawer ${drawerOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal={drawerOpen ? "true" : "false"}
      >
        <div className="catalogue-drawer-header">
          <h2>Filters</h2>
          <button
            className="button-link"
            onClick={() => setDrawerOpen(false)}
            ref={closeButtonRef}
            type="button"
          >
            Show {total} jobs
          </button>
        </div>
        {drawerOpen && (
          <div className="catalogue-drawer-body">
            <FacetSidebar
              facets={data.facets}
              filters={filters}
              onClearAll={clearAll}
              onClearGroup={(group) => clearGroup(group)}
              onToggle={(group, value) => updateFacet(group, value)}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
