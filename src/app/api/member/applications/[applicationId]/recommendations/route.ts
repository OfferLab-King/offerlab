import { NextResponse } from "next/server";

import { logger } from "../../../../../../infrastructure/logging/logger";
import { isApplicationId } from "../../../../../../modules/applications/domain/application";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { mutateRecommendationState } from "../../../../../../modules/recommendations/application/recommendations";
import {
  parseRecommendationMutationInput,
  readRecommendationJson,
} from "../../../../../../modules/recommendations/application/request";
import { applicationApiOwner, genericApplicationError } from "../../access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = Readonly<{ params: Promise<{ applicationId: string }> }>;

const genericResponse = (status: number) => NextResponse.json(genericApplicationError, { status });

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return genericResponse(403);
  const access = await applicationApiOwner();
  if ("response" in access) return access.response;

  const body = await readRecommendationJson(request);
  if (!body.ok) return genericResponse(body.status);
  const parsed = parseRecommendationMutationInput(body.value);
  if (!parsed.ok) return genericResponse(422);

  const { applicationId } = await context.params;
  if (!isApplicationId(applicationId)) return genericResponse(404);

  try {
    const result = await mutateRecommendationState(access.ownerId, applicationId, parsed.value);
    if (result.outcome === "not_found") return genericResponse(404);
    if (result.outcome === "invalid") return genericResponse(422);
    if (result.outcome === "conflict" || result.outcome === "not_applicable") {
      return NextResponse.json({ ok: true, outcome: result.outcome }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch {
    logger.error(
      { event: "recommendation_state_mutation_failed" },
      "Recommendation state mutation failed",
    );
    return genericResponse(500);
  }
}
