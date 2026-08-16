import type { Metadata } from "next";
import Link from "next/link";
import { isLocalAuthBypassEnabled } from "../../infrastructure/config/local-development";
import { AuthShell, StatusMessage } from "../components/auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Sign in | OfferLab",
};

export default async function SignInPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const next = typeof query.next === "string" ? query.next : "/member";
  const notice = query["password-reset"]
    ? "Your password has been updated. Sign in to continue."
    : query.verified
      ? "Your email is verified. Sign in to continue."
      : query["signed-out"]
        ? "You have signed out."
        : undefined;

  return (
    <AuthShell description="Use your verified OfferLab account." title="Sign in">
      <StatusMessage>{error ?? notice}</StatusMessage>
      {isLocalAuthBypassEnabled() && (
        <p>
          <Link className="button-link" href="/member">
            Open local test workspace
          </Link>
        </p>
      )}
      <SignInForm next={next} />
      <p>
        <a href="/reset-password">Forgot your password?</a>
      </p>
    </AuthShell>
  );
}
