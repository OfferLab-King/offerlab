import Link from "next/link";
import { redirect } from "next/navigation";
import { recruitmentStages } from "../../../../modules/applications/domain/application";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import {
  parseLibraryFilters,
  readLibrary,
  readLibraryTaxonomy,
} from "../../../../modules/preparation-resources/application/resources";
import { resourceTypeLabels } from "../../../../modules/preparation-resources/domain/resource";
import { opportunityTypes } from "../../../../modules/taxonomy/domain/opportunity-types";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { ResourceCard } from "../resource-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResourceLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  const filters = parseLibraryFilters(params);
  const [resources, taxonomy] = await Promise.all([
    readLibrary(auth.userId, filters),
    readLibraryTaxonomy(auth.userId),
  ]);
  const secondaryFiltersActive = Boolean(
    filters.category ||
    filters.tag ||
    filters.opportunityType ||
    filters.saved ||
    filters.completed,
  );
  const activeFilters = [
    filters.query && `Search: ${filters.query}`,
    filters.stage && recruitmentStages[filters.stage as keyof typeof recruitmentStages],
    filters.type && resourceTypeLabels[filters.type as keyof typeof resourceTypeLabels],
    filters.category && taxonomy.categories.find((item) => item.slug === filters.category)?.name,
    filters.tag && taxonomy.tags.find((item) => item.slug === filters.tag)?.name,
    filters.opportunityType &&
      opportunityTypes[filters.opportunityType as keyof typeof opportunityTypes],
    filters.saved && "Saved only",
    filters.completed === "complete" && "Completed",
    filters.completed === "incomplete" && "Not completed",
  ].filter(Boolean) as string[];

  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="resources" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Supporting material</p>
          <h1>Resource Library</h1>
          <p className="intro">
            Browse guides, exercises, checklists and videos for specific preparation needs.
          </p>
        </div>
      </section>
      <form className="library-filters" method="get">
        <div className="primary-filters">
          <label>
            Search resources
            <input defaultValue={filters.query} maxLength={120} name="q" type="search" />
          </label>
          <label>
            Recruitment stage
            <select defaultValue={filters.stage ?? ""} name="stage">
              <option value="">All stages</option>
              {Object.entries(recruitmentStages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Content type
            <select defaultValue={filters.type ?? ""} name="type">
              <option value="">All types</option>
              {Object.entries(resourceTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </div>
        <details className="more-filters" open={secondaryFiltersActive}>
          <summary>More filters</summary>
          <div className="secondary-filters">
            <label>
              Category
              <select defaultValue={filters.category ?? ""} name="category">
                <option value="">All categories</option>
                {taxonomy.categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tag
              <select defaultValue={filters.tag ?? ""} name="tag">
                <option value="">All tags</option>
                {taxonomy.tags.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opportunity type
              <select defaultValue={filters.opportunityType ?? ""} name="opportunityType">
                <option value="">All opportunities</option>
                {Object.entries(opportunityTypes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Completion
              <select defaultValue={filters.completed ?? ""} name="completed">
                <option value="">Any</option>
                <option value="complete">Completed</option>
                <option value="incomplete">Not completed</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input defaultChecked={filters.saved} name="saved" type="checkbox" value="1" />
              Saved only
            </label>
          </div>
        </details>
        <div className="filter-actions">
          <button type="submit">Apply all filters</button>
          <Link href="/member/learn/resources">Reset filters</Link>
        </div>
      </form>
      {activeFilters.length > 0 && (
        <div aria-label="Active filters" className="active-filters">
          {activeFilters.map((filter) => (
            <span key={filter}>{filter}</span>
          ))}
        </div>
      )}
      <p aria-live="polite" role="status">
        {resources.length} resource{resources.length === 1 ? "" : "s"} shown
      </p>
      {resources.length ? (
        <div className="resource-grid">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <section className="card empty-state">
          <h2>No matching resources</h2>
          <p>Try clearing one or more filters.</p>
          <Link href="/member/learn/resources">Clear filters</Link>
        </section>
      )}
      {resources.length === 12 && (
        <Link
          href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(filters.page + 1) })}`}
        >
          Next page
        </Link>
      )}
    </main>
  );
}
