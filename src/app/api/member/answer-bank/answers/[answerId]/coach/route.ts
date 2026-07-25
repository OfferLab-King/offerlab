import { NextResponse } from "next/server";
import { reviewMemberAnswer } from "../../../../../../../modules/answer-coach/application/review-answer";
import { hasSameOrigin } from "../../../../../../../modules/identity-access/application/request-security";
import { generic, owner } from "../../../access";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ answerId: string }> }) {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const access = await owner();
  if ("response" in access) return access.response;
  const result = await reviewMemberAnswer(access.ownerId, (await context.params).answerId);
  return result ? NextResponse.json(result) : NextResponse.json(generic, { status: 404 });
}
