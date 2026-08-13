import { NextResponse } from "next/server";

import { searchEmployersForAutocomplete } from "../../../../modules/job-catalog/application/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const results = await searchEmployersForAutocomplete(q);
  return NextResponse.json({ results });
}
