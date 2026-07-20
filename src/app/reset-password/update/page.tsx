import { AuthShell, StatusMessage } from "../../components/auth-shell";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  return (
    <AuthShell description="Choose a new password for your account." title="Set new password">
      <StatusMessage>{error}</StatusMessage>
      <UpdatePasswordForm />
    </AuthShell>
  );
}
