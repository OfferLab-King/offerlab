import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { SignOutButton } from "../components/sign-out-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Access denied | OfferLab",
};

export default function AccessDeniedPage() {
  return (
    <AuthShell
      description="Your account does not have administrator permission."
      title="Access denied"
    >
      <a className="button-link" href="/member">
        Return to member area
      </a>
      <SignOutButton />
    </AuthShell>
  );
}
