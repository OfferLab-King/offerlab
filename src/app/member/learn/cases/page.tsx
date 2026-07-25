import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readLibraryPage } from "../../../../modules/preparation-resources/application/resources";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { ResourceCard } from "../resource-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CoachingCasesPage() {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const { resources } = await readLibraryPage(auth.userId, {
    page: 1,
    query: "",
    queryInvalid: false,
    saved: false,
    type: "coaching_case",
  });
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="cases" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">See the thinking</p>
          <h1>Annotated Coaching Cases</h1>
          <p className="intro">
            Study realistic, founder-reviewed examples with the reasoning, trade-offs and coaching
            notes made visible—not polished model answers to copy.
          </p>
        </div>
      </section>
      {resources.length ? (
        <div className="resource-grid">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <section className="card empty-state">
          <h2>The first cases are being reviewed</h2>
          <p>
            OfferLab only publishes a case after its reasoning and annotations have been checked.
            Use the Resource Library while the first collection is prepared.
          </p>
          <Link href="/member/learn/resources">Browse preparation resources</Link>
        </section>
      )}
    </main>
  );
}
