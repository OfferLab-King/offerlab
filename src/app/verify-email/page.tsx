import { AuthShell } from "../components/auth-shell";
import { VerificationResendForm } from "./verification-resend-form";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      description="Open the verification message sent by Supabase and follow its link. Member access remains locked until your email is verified and your invitation is claimed."
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
