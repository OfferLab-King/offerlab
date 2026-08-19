import { NextResponse } from "next/server";

import { isJobCatalogEnabled } from "../../../../modules/job-catalog/application/config";
import { searchEmployersForAutocomplete } from "../../../../modules/job-catalog/application/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isJobCatalogEnabled()) {
    return NextResponse.json({ results: [] }, { status: 404 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const results = await searchEmployersForAutocomplete(q);
  return NextResponse.json({ results });
}
