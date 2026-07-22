import { notFound, redirect } from "next/navigation";
import { ResourceContent } from "../../../components/resource-content";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readMemberResource } from "../../../../modules/preparation-resources/application/resources";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { ResourceStateControls } from "./resource-state-controls";
import Link from "next/link";
import { readPathsForResource } from "../../../../modules/learning-paths/application/learning-paths";
import { LearnNavigation } from "../learn-navigation";
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
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="resources" />
      {fromPath && paths.some((path) => path.slug === fromPath) && (
        <p>
          <Link href={`/member/learn/paths/${fromPath}`}>← Back to Preparation Plan</Link>
        </p>
      )}
      <ResourceContent resource={r} />
      <ResourceStateControls completed={!!r.completedAt} resourceId={r.id} saved={!!r.savedAt} />
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
