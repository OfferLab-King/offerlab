import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import {
  continueItem,
  readLearningPaths,
} from "../../../../modules/learning-paths/application/learning-paths";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const category = (await searchParams).category;
  const all = await readLearningPaths(auth.userId);
  const paths = category ? all.filter((path) => path.categoryName === category) : all;
  const categories = [...new Set(all.map((path) => path.categoryName).filter(Boolean))] as string[];
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Guided preparation</p>
          <h1>Learning paths</h1>
          <p className="intro">Follow a recommended sequence, or open any resource in any order.</p>
        </div>
        <Link href="/member/learn">Explore all resources</Link>
      </section>
      {categories.length > 1 && (
        <form className="path-filter">
          <label>
            Category{" "}
            <select defaultValue={category ?? ""} name="category">
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button type="submit">Filter</button>
        </form>
      )}
      <p aria-live="polite" role="status">
        {paths.length} learning path{paths.length === 1 ? "" : "s"}
      </p>
      {paths.length ? (
        <div className="path-grid">
          {paths.map((path) => {
            const next = continueItem(path);
            const status =
              path.progress === 100
                ? "Complete"
                : path.completedCount
                  ? "In progress"
                  : "Not started";
            return (
              <article className="card path-card" key={path.id}>
                <p className="eyebrow">{path.categoryName ?? "Learning path"}</p>
                <h2>{path.title}</h2>
                <p>{path.shortDescription}</p>
                <p>
                  {path.totalCount} resources · {path.estimatedMinutes || "Flexible"}{" "}
                  {path.estimatedMinutes ? "minutes" : "timing"}
                </p>
                <progress
                  aria-label={`${path.title}: ${path.progress}% complete`}
                  max="100"
                  value={path.progress}
                />
                <p>
                  {path.completedCount} of {path.totalCount} complete · {status}
                </p>
                <Link
                  className="button-link"
                  href={
                    next ? `/member/learn/paths/${path.slug}` : `/member/learn/paths/${path.slug}`
                  }
                >
                  {next ? "Continue learning" : "Revisit path"}
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card empty-state">
          <h2>No learning paths found</h2>
          <p>Try another category, or continue exploring the Knowledge Library.</p>
          <Link href="/member/learn/paths">Clear filter</Link>
        </section>
      )}
    </main>
  );
}
