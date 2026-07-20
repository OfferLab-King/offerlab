import { AuthShell } from "../components/auth-shell";
import { RecoveryRequestForm } from "./recovery-request-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Enter your email. If an account is eligible, Supabase will send recovery instructions."
      title="Reset password"
    >
      <RecoveryRequestForm />
      <p>
        <a href="/sign-in">Return to sign in</a>
      </p>
    </AuthShell>
  );
}
