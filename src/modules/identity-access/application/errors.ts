export type IdentityAccessErrorCode =
  "duplicate_identity" | "email_mismatch" | "invalid_invitation" | "unverified_identity";

export class IdentityAccessError extends Error {
  public constructor(
    public readonly code: IdentityAccessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityAccessError";
  }
}
