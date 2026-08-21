import { NextResponse } from "next/server";
import { z } from "zod";
import {
  readAnswerCoachConfiguration,
  readAnswerCoachUsage,
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
    configuration: readAnswerCoachConfiguration(),
    reviews: await readAnswerReviews(access.ownerId, (await context.params).answerId),
    usage: await readAnswerCoachUsage(access.ownerId),
  });
}
export async function POST(request: Request, context: { params: Promise<{ answerId: string }> }) {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const access = await owner();
  if ("response" in access) return access.response;
  try {
    const text = await request.text();
    const body = z
      .object({ modelConsent: z.boolean().optional().default(false) })
      .strict()
      .parse(text ? JSON.parse(text) : {});
    const result = await reviewMemberAnswer(access.ownerId, (await context.params).answerId, body);
    return result ? NextResponse.json(result) : NextResponse.json(generic, { status: 404 });
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
        { message: "You have reached this month's Answer Coach limit." },
        { status: 429 },
      );
    if (code === "answer_coach_consent_required")
      return NextResponse.json(
        { message: "Confirm the AI data notice before requesting this review." },
        { status: 422 },
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
