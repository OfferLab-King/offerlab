import { AuthShell } from "../components/auth-shell";
import { SignOutButton } from "../components/sign-out-button";

export default function BetaAccessDeniedPage() {
  return (
    <AuthShell
      description="Your account is verified, but it does not currently have an active OfferLab beta entitlement."
      title="Beta access unavailable"
    >
      <p>Contact the person who invited you if you think this is a mistake.</p>
      <SignOutButton />
    </AuthShell>
  );
}
