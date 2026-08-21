import { redirect } from "next/navigation";

import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { ApplicationForm } from "../application-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  return (
    <main className="applications-shell">
      <section className="card application-form-card">
        <p className="eyebrow">Application tracker</p>
        <h1>Add application</h1>
        <p className="intro">Required fields are marked. You can add dates and notes later.</p>
        <ApplicationForm />
      </section>
    </main>
  );
}
