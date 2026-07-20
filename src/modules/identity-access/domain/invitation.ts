export type InvitationState = Readonly<{
  consumedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

export type InvitationRejection = "consumed" | "expired" | "revoked";

export function invitationRejection(
  invitation: InvitationState,
  now: Date,
): InvitationRejection | null {
  if (invitation.revokedAt) return "revoked";
  if (invitation.consumedAt) return "consumed";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}

export function canConsumeInvitation(invitation: InvitationState, now: Date): boolean {
  return invitationRejection(invitation, now) === null;
}
