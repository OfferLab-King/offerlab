import { AuthShell, StatusMessage } from "../components/auth-shell";
import { RegistrationForm } from "./registration-form";

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;

  return (
    <AuthShell
      description="Build your applications, preparation plans, evidence stories and interview answers in one place."
      title="Create your OfferLab account"
    >
      <StatusMessage>{error}</StatusMessage>
      <RegistrationForm />
      <p>
        Already registered? <a href="/sign-in">Sign in</a>
      </p>
    </AuthShell>
  );
}
