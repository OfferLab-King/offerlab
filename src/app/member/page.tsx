import { requireMember } from "../../modules/identity-access/application/authorization";
import { SignOutButton } from "../components/sign-out-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  await requireMember();
  return (
    <main>
      <section className="card">
        <p className="eyebrow">Protected member route</p>
        <h1>Welcome to OfferLab</h1>
        <p>Your verified invitation and active beta entitlement have been confirmed.</p>
        <p>
          <a href="/admin">Administration</a>
        </p>
        <SignOutButton />
      </section>
    </main>
  );
}
