import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readLearningPaths } from "../../../../modules/learning-paths/application/learning-paths";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { PreparationPlanCard } from "../preparation-plan-card";
import { planKind } from "../learn-presenters";
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
  const foundations = paths.filter((path) => planKind(path) === "foundation");
  const stagePaths = paths.filter((path) => planKind(path) === "stage");
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="paths" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Guided preparation</p>
          <h1>Preparation Plans</h1>
          <p className="intro">
            Choose a complete preparation structure for the stage you are facing. The order is
            recommended, not locked.
          </p>
        </div>
        <Link href="/member/learn/resources">Browse Resources</Link>
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
      {all.length === 0 ? (
        <section className="card empty-state">
          <h2>Preparation Plans are not available yet.</h2>
          <p>Browse focused resources while new plans are being prepared.</p>
          <Link href="/member/learn/resources">Browse Resources</Link>
        </section>
      ) : paths.length === 0 ? (
        <section className="card empty-state">
          <h2>No Preparation Plans match this filter.</h2>
          <Link href="/member/learn/paths">Clear filter</Link>
        </section>
      ) : (
        <>
          <p aria-live="polite" role="status">
            {paths.length} Preparation Plan{paths.length === 1 ? "" : "s"}
          </p>
          {foundations.length > 0 && (
            <section aria-labelledby="catalogue-foundations" className="catalogue-group">
              <p className="eyebrow">Foundational preparation</p>
              <h2 id="catalogue-foundations">Interview foundations</h2>
              <p>Build reusable preparation that supports more than one recruitment stage.</p>
              <div className="path-grid catalogue-grid">
                {foundations.map((path) => (
                  <PreparationPlanCard key={path.id} path={path} />
                ))}
              </div>
            </section>
          )}
          {stagePaths.length > 0 && (
            <section aria-labelledby="catalogue-stages" className="catalogue-group">
              <p className="eyebrow">Stage-based preparation</p>
              <h2 id="catalogue-stages">Recruitment stages</h2>
              <p>Choose the plan for the next stage in your application process.</p>
              <div className="path-grid catalogue-grid">
                {stagePaths.map((path) => (
                  <PreparationPlanCard key={path.id} path={path} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
