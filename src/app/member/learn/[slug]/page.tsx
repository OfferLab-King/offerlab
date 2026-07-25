import { notFound, redirect } from "next/navigation";
import { ResourceContent } from "../../../components/resource-content";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readMemberResource } from "../../../../modules/preparation-resources/application/resources";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { ResourceStateControls } from "./resource-state-controls";
import Link from "next/link";
import {
  readLearningPathContext,
  readPathsForResource,
} from "../../../../modules/learning-paths/application/learning-paths";
import { LearnNavigation } from "../learn-navigation";
import { resourcePlanContext } from "../learn-presenters";
import { CoachingCaseView } from "../coaching-case-view";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const r = await readMemberResource(auth.userId, (await params).slug);
  if (!r) notFound();
  const paths = await readPathsForResource(auth.userId, r.id);
  const fromPath = (await searchParams).path;
  const validPath =
    fromPath && paths.some((path) => path.slug === fromPath)
      ? await readLearningPathContext(auth.userId, fromPath)
      : null;
  const context = validPath ? resourcePlanContext(validPath, r.id) : null;
  const backToPlanHref = context ? `/member/learn/paths/${context.path.slug}` : undefined;
  const completionHref = context?.nextActivity
    ? `/member/learn/${context.nextActivity.slug}?path=${context.path.slug}`
    : backToPlanHref
      ? `${backToPlanHref}?completed=1`
      : undefined;
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active={context ? "paths" : "resources"} />
      {context && (
        <nav aria-label="Current Preparation Plan" className="resource-plan-context">
          <Link href={backToPlanHref! as never}>{context.path.title}</Link>
          <span>{context.section.heading}</span>
          <span>
            Activity {context.activityNumber} of {context.activityTotal}
          </span>
        </nav>
      )}
      <ResourceContent resource={r} />
      {r.resourceType === "coaching_case" && r.coachingCase && (
        <CoachingCaseView detail={r.coachingCase} />
      )}
      <ResourceStateControls
        {...(backToPlanHref ? { backToPlanHref } : {})}
        completed={!!r.completedAt}
        {...(completionHref ? { completionHref } : {})}
        inPlan={Boolean(context)}
        resourceId={r.id}
        saved={!!r.savedAt}
      />
      {context && (
        <nav aria-label="Plan activity navigation" className="activity-navigation">
          {context.previousActivity ? (
            <Link href={`/member/learn/${context.previousActivity.slug}?path=${context.path.slug}`}>
              ← Previous activity
            </Link>
          ) : (
            <span />
          )}
          <Link href={backToPlanHref! as never}>Back to plan</Link>
          {context.nextActivity ? (
            <Link href={`/member/learn/${context.nextActivity.slug}?path=${context.path.slug}`}>
              Next activity →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      {paths.length > 0 && (
        <section className="resource-content card">
          <h2>Part of these Preparation Plans</h2>
          <ul>
            {paths.map((path) => (
              <li key={path.slug}>
                <Link href={`/member/learn/paths/${path.slug}`}>{path.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
