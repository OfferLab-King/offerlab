import { NextResponse } from "next/server";
import {
  editStory,
  readStory,
  setStoryArchived,
} from "../../../../../../modules/answer-bank/application/answer-bank";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { generic, owner } from "../../access";
type C = { params: Promise<{ storyId: string }> };
export const runtime = "nodejs";
export async function GET(_: Request, c: C) {
  const a = await owner();
  if ("response" in a) return a.response;
  const x = await readStory(a.ownerId, (await c.params).storyId);
  return x ? NextResponse.json({ story: x }) : NextResponse.json(generic, { status: 404 });
}
export async function PUT(r: Request, c: C) {
  if (!hasSameOrigin(r)) return NextResponse.json(generic, { status: 403 });
  const a = await owner();
  if ("response" in a) return a.response;
  try {
    const b = await r.json(),
      x = await editStory(a.ownerId, (await c.params).storyId, Number(b.version), b);
    return NextResponse.json(x, {
      status: !x.ok ? 422 : x.outcome === "conflict" ? 409 : x.outcome === "not_found" ? 404 : 200,
    });
  } catch {
    return NextResponse.json(generic, { status: 500 });
  }
}
export async function PATCH(r: Request, c: C) {
  if (!hasSameOrigin(r)) return NextResponse.json(generic, { status: 403 });
  const a = await owner();
  if ("response" in a) return a.response;
  const b = await r.json();
  const x = await setStoryArchived(
    a.ownerId,
    (await c.params).storyId,
    Number(b.version),
    b.archive === true,
  );
  return NextResponse.json(x, {
    status: x.outcome === "conflict" ? 409 : x.outcome === "not_found" ? 404 : 200,
  });
}
