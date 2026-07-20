import { AuthShell, StatusMessage } from "../components/auth-shell";
import { InvitationForm } from "./invitation-form";

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AuthShell
      description="Create your account with the email address that received this invitation."
      title="Accept invitation"
    >
      <StatusMessage>{error}</StatusMessage>
      <InvitationForm />
      <p>
        Already registered? <a href="/sign-in">Sign in</a>
      </p>
    </AuthShell>
  );
}
