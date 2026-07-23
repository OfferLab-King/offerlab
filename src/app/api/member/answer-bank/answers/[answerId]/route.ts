import { NextResponse } from "next/server";
import {
  editAnswer,
  readAnswer,
  setAnswerArchived,
} from "../../../../../../modules/answer-bank/application/answer-bank";
import { hasSameOrigin } from "../../../../../../modules/identity-access/application/request-security";
import { generic, owner } from "../../access";
type C = { params: Promise<{ answerId: string }> };
export const runtime = "nodejs";
export async function GET(_: Request, c: C) {
  const a = await owner();
  if ("response" in a) return a.response;
  const x = await readAnswer(a.ownerId, (await c.params).answerId);
  return x ? NextResponse.json({ answer: x }) : NextResponse.json(generic, { status: 404 });
}
export async function PUT(r: Request, c: C) {
  if (!hasSameOrigin(r)) return NextResponse.json(generic, { status: 403 });
  const a = await owner();
  if ("response" in a) return a.response;
  try {
    const b = await r.json(),
      x = await editAnswer(a.ownerId, (await c.params).answerId, Number(b.version), b);
    return NextResponse.json(x, {
      status: !x.ok ? 422 : x.outcome === "conflict" ? 409 : x.outcome === "not_found" ? 404 : 200,
    });
  } catch {
    return NextResponse.json(generic, { status: 422 });
  }
}
export async function PATCH(r: Request, c: C) {
  if (!hasSameOrigin(r)) return NextResponse.json(generic, { status: 403 });
  const a = await owner();
  if ("response" in a) return a.response;
  const b = await r.json();
  const x = await setAnswerArchived(
    a.ownerId,
    (await c.params).answerId,
    Number(b.version),
    b.archive === true,
  );
  return NextResponse.json(x, {
    status: x.outcome === "conflict" ? 409 : x.outcome === "not_found" ? 404 : 200,
  });
}
