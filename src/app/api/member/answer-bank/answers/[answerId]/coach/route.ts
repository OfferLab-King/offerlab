import { NextResponse } from "next/server";
import {
  readAnswerReviews,
  reviewMemberAnswer,
  updateAnswerReviewComment,
} from "../../../../../../../modules/answer-coach/application/review-answer";
import { hasSameOrigin } from "../../../../../../../modules/identity-access/application/request-security";
import { generic, owner } from "../../../access";

export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ answerId: string }> }) {
  const access = await owner();
  if ("response" in access) return access.response;
  return NextResponse.json({
    reviews: await readAnswerReviews(access.ownerId, (await context.params).answerId),
  });
}
export async function POST(request: Request, context: { params: Promise<{ answerId: string }> }) {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const access = await owner();
  if ("response" in access) return access.response;
  try {
    const result = await reviewMemberAnswer(access.ownerId, (await context.params).answerId);
    return result
      ? NextResponse.json({ review: result })
      : NextResponse.json(generic, { status: 404 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "answer_coach_disabled")
      return NextResponse.json(
        { message: "Answer Coach is temporarily unavailable." },
        { status: 503 },
      );
    if (code === "answer_coach_rate_limited")
      return NextResponse.json(
        { message: "You have reviewed several answers recently. Try again in a few minutes." },
        { status: 429 },
      );
    if (code === "answer_coach_usage_capped")
      return NextResponse.json(
        { message: "You have reached this month's Answer Coach pilot limit." },
        { status: 429 },
      );
    return NextResponse.json(generic, { status: 422 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ answerId: string }> }) {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const access = await owner();
  if ("response" in access) return access.response;
  try {
    const body = await request.json();
    const result = await updateAnswerReviewComment(
      access.ownerId,
      (await context.params).answerId,
      String(body.commentId),
      body.state,
    );
    return NextResponse.json(result, { status: result.outcome === "not_found" ? 404 : 200 });
  } catch {
    return NextResponse.json(generic, { status: 422 });
  }
}
