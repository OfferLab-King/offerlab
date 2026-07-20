import { AuthShell } from "../components/auth-shell";

export default function AccessDeniedPage() {
  return (
    <AuthShell
      description="Your account does not have administrator permission."
      title="Access denied"
    >
      <a className="button-link" href="/member">
        Return to member area
      </a>
    </AuthShell>
  );
}
