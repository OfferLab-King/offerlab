import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { VerificationResendForm } from "./verification-resend-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Verify your email | OfferLab",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      description="Open the verification message we sent you and follow its link. Member access remains locked until your email is verified."
      title="Verify your email"
    >
      <p className="status">
        If you do not see the message, check your spam folder or try signing in again.
      </p>
      <VerificationResendForm />
      <a className="button-link" href="/sign-in">
        Return to sign in
      </a>
    </AuthShell>
  );
}
