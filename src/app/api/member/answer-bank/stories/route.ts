import { NextResponse } from "next/server";
import { addStory, readStories } from "../../../../../modules/answer-bank/application/answer-bank";
import { hasSameOrigin } from "../../../../../modules/identity-access/application/request-security";
import { generic, owner } from "../access";
export const runtime = "nodejs";
export async function GET() {
  const a = await owner();
  if ("response" in a) return a.response;
  return NextResponse.json({ stories: await readStories(a.ownerId) });
}
export async function POST(r: Request) {
  if (!hasSameOrigin(r)) return NextResponse.json(generic, { status: 403 });
  const a = await owner();
  if ("response" in a) return a.response;
  try {
    const x = await addStory(a.ownerId, await r.json());
    return NextResponse.json(x, { status: x.ok ? 201 : 422 });
  } catch {
    return NextResponse.json(generic, { status: 500 });
  }
}
