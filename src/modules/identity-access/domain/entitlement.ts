export type BetaEntitlementStatus = "active" | "revoked" | null;

export function hasActiveBetaEntitlement(status: BetaEntitlementStatus): boolean {
  return status === "active";
}
