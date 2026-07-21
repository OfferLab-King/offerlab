import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import {
  parseLibraryFilters,
  readLibrary,
  readLibraryTaxonomy,
} from "../../../modules/preparation-resources/application/resources";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);
  const filters = parseLibraryFilters(params);
  const [resources, taxonomy] = await Promise.all([
    readLibrary(auth.userId, filters),
    readLibraryTaxonomy(auth.userId),
  ]);
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Knowledge library</p>
          <h1>Learn what to do next</h1>
          <p className="intro">Focused OfferLab guidance for each stage of your applications.</p>
        </div>
      </section>
      <form className="library-filters" method="get">
        <label>
          Search resources
          <input defaultValue={filters.query} maxLength={120} name="q" type="search" />
        </label>
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
          Content type
          <select defaultValue={filters.type ?? ""} name="type">
            <option value="">All types</option>
            {["guide", "checklist", "template", "video", "exercise", "article"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Opportunity type
          <select defaultValue={filters.opportunityType ?? ""} name="opportunityType">
            <option value="">All opportunities</option>
            {["graduate_scheme", "internship", "placement", "entry_level_role"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Recruitment stage
          <select defaultValue={filters.stage ?? ""} name="stage">
            <option value="">All stages</option>
            {[
              "preparing",
              "applied",
              "online_assessment",
              "video_interview",
              "interview",
              "assessment_centre",
              "offer",
            ].map((v) => (
              <option key={v}>{v.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          <input defaultChecked={filters.saved} name="saved" type="checkbox" value="1" /> Saved only
        </label>
        <label>
          Completion
          <select defaultValue={filters.completed ?? ""} name="completed">
            <option value="">Any</option>
            <option value="complete">Completed</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </label>
        <button type="submit">Apply filters</button>
        <Link href="/member/learn">Clear filters</Link>
      </form>
      <p aria-live="polite" role="status">
        {resources.length} resource{resources.length === 1 ? "" : "s"} shown
      </p>
      {resources.length ? (
        <div className="resource-grid">
          {resources.map((r) => (
            <article className="card resource-card" key={r.id}>
              <p className="eyebrow">
                {r.resourceType} · {r.categoryName}
              </p>
              <h2>{r.title}</h2>
              <p>{r.shortDescription}</p>
              <p>{r.stages.join(", ")}</p>
              <p>
                {r.savedAt ? "Saved" : "Not saved"} · {r.completedAt ? "Completed" : "Incomplete"}
              </p>
              <Link className="button-link" href={`/member/learn/${r.slug}`}>
                Open resource
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="card empty-state">
          <h2>No resources found</h2>
          <p>Try removing one or more filters.</p>
          <Link href="/member/learn">Clear filters</Link>
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
