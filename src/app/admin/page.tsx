import { requireAdministrator } from "../../modules/identity-access/application/authorization";
import { SignOutButton } from "../components/sign-out-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdministratorPage() {
  await requireAdministrator();
  return (
    <main>
      <section className="card">
        <p className="eyebrow">Protected administrator route</p>
        <h1>OfferLab administration</h1>
        <p>Administrator authorization has been confirmed.</p>
        <SignOutButton />
      </section>
    </main>
  );
}
