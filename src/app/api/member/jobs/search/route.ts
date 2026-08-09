import { NextResponse } from "next/server";
import {
  JobSearchUsageLimitError,
  searchJobsForMember,
} from "../../../../../modules/job-discovery/application/search-jobs";
import { createJobDiscoveryRuntime } from "../../../../../modules/job-discovery/infrastructure/provider-runtime";
import { JobDiscoveryProviderError } from "../../../../../modules/job-discovery/infrastructure/jsearch-provider";
import { hasSameOrigin } from "../../../../../modules/identity-access/application/request-security";
import { careerApiOwner, genericCareerError } from "../../career/access";
import {
  CareerRequestBodyError,
  careerRequestBodyLimits,
  readBoundedJsonBody,
} from "../../career/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(genericCareerError, { status: 403 });
  const access = await careerApiOwner();
  if ("response" in access) return access.response;
  let input: unknown;
  try {
    input = await readBoundedJsonBody(request, careerRequestBodyLimits.jobSearchBytes);
  } catch (error) {
    if (error instanceof CareerRequestBodyError) {
      return NextResponse.json(genericCareerError, {
        status: error.reason === "too_large" ? 413 : 422,
      });
    }
    return NextResponse.json(genericCareerError, { status: 422 });
  }
  const runtime = createJobDiscoveryRuntime({
    apiKey: process.env.JSEARCH_API_KEY,
    appEnvironment: process.env.APP_ENV,
    enabled: process.env.JSEARCH_ENABLED === "true",
    productionUseApproved: process.env.JSEARCH_COMMERCIAL_USE_APPROVED === "true",
  });
  if (!runtime.available) {
    return NextResponse.json(
      {
        message:
          runtime.reason === "production_not_approved"
            ? "External job search is awaiting provider approval. You can still add a role manually."
            : "External job search is not configured. You can still add a role manually.",
      },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json(
      await searchJobsForMember(access.ownerId, input, {
        provider: runtime.provider,
      }),
    );
  } catch (error) {
    if (error instanceof JobSearchUsageLimitError) {
      return NextResponse.json(
        {
          message:
            "You have reached the current job-search allowance. Saved and manually added roles remain available.",
        },
        { status: 429 },
      );
    }
    if (error instanceof JobDiscoveryProviderError) {
      const rateLimited = error.code === "job_discovery_provider_rate_limited";
      return NextResponse.json(
        {
          message: rateLimited
            ? "Job search is temporarily at its request limit. Try again later."
            : "Job search is temporarily unavailable. Try again later.",
        },
        { status: rateLimited ? 429 : 503 },
      );
    }
    return NextResponse.json(
      { message: "Check the search fields and try again." },
      { status: 422 },
    );
  }
}
