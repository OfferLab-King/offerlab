import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { RecoveryRequestForm } from "./recovery-request-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Reset password | OfferLab",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Enter your email. If an account is eligible, we will send password recovery instructions."
      title="Reset password"
    >
      <RecoveryRequestForm />
      <p>
        <a href="/sign-in">Return to sign in</a>
      </p>
    </AuthShell>
  );
}
