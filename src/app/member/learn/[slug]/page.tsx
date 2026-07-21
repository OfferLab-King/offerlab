import { notFound, redirect } from "next/navigation";
import { ResourceContent } from "../../../components/resource-content";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readMemberResource } from "../../../../modules/preparation-resources/application/resources";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { ResourceStateControls } from "./resource-state-controls";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const r = await readMemberResource(auth.userId, (await params).slug);
  if (!r) notFound();
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <ResourceContent resource={r} />
      <ResourceStateControls completed={!!r.completedAt} resourceId={r.id} saved={!!r.savedAt} />
    </main>
  );
}
