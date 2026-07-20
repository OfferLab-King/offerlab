export type PublicAuthError =
  "generic" | "invalid_credentials" | "invalid_invitation" | "password_policy" | "rate_limited";

export function publicAuthErrorMessage(error: PublicAuthError): string {
  switch (error) {
    case "invalid_credentials":
      return "We could not sign you in with those details.";
    case "invalid_invitation":
      return "This invitation cannot be used. Ask the person who invited you for a new link.";
    case "password_policy":
      return "Use at least 10 characters, including upper and lower case letters and a number.";
    case "rate_limited":
      return "Too many attempts. Please wait and try again.";
    case "generic":
      return "Something went wrong. Please try again.";
  }
}

export function mapSupabasePublicError(message: string, status?: number): PublicAuthError {
  if (status === 429) return "rate_limited";
  if (/password/i.test(message)) return "password_policy";
  if (/invalid login credentials/i.test(message)) return "invalid_credentials";
  return "generic";
}
