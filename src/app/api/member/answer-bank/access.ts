import { NextResponse } from "next/server";
import { currentMemberAccess } from "../../../../modules/identity-access/application/authorization";
export const generic = { message: "We could not complete that request." };

/**
 * Resolves the authenticated member for answer-bank API routes. Unlike the
 * previous implementation, only authentication failures produce 401;
 * entitlement denials produce 403, and server failures propagate instead of
 * being masked as authentication errors.
 */
export async function owner() {
  const access = await currentMemberAccess();
  if (access.status === "unauthenticated") {
    return { response: NextResponse.json(generic, { status: 401 }) };
  }
  if (access.status !== "eligible") {
    return { response: NextResponse.json(generic, { status: 403 }) };
  }
  return { ownerId: access.authorization.userId };
}
