import { NextResponse } from "next/server";

import { searchJobCatalogFaceted } from "../../../../modules/job-catalog/application/catalog";
import { parseJobCatalogFilters } from "../../../../modules/job-catalog/domain/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public faceted catalogue search used by the interactive /jobs view.
 * Returns results plus disjunctive facet counts in one request. Filter state
 * is carried entirely in URL query parameters, so responses are cacheable and
 * shareable. Read-only public data: the middleware gate removes the route when
 * the catalogue is disabled, and no sensitive data is returned.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filters = parseJobCatalogFilters(url.searchParams);
  try {
    const payload = await searchJobCatalogFaceted(filters);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "The catalogue is temporarily unavailable." },
      { status: 500 },
    );
  }
}
