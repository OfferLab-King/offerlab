import { NextResponse } from "next/server";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
export const generic = { message: "We could not complete that request." };
export async function owner() {
  try {
    return { ownerId: (await requireMember()).userId };
  } catch {
    return { response: NextResponse.json(generic, { status: 401 }) };
  }
}
