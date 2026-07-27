import { z } from "zod";

export const communityTermsVersion = "2026-07-27";
export const commentFlagReasons = {
  abusive: "Abusive or disrespectful",
  confidentiality: "Confidential or restricted information",
  copyright: "Copied assessment material",
  inaccurate: "Materially inaccurate",
  other: "Another safety concern",
  personal_information: "Personal or identifying information",
} as const;

export type CommentFlagReason = keyof typeof commentFlagReasons;

const cleanBody = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

const commentSchema = z
  .object({
    agreementConfirmed: z.boolean(),
    body: z.string(),
    parentCommentId: z.string().uuid().nullable(),
    reportId: z.string().uuid(),
  })
  .strict();

export type CommentInput = Readonly<{
  agreementConfirmed: boolean;
  body: string;
  parentCommentId: string | null;
  reportId: string;
}>;

export function parseComment(
  input: unknown,
): Readonly<{ error: "invalid"; ok: false }> | Readonly<{ ok: true; value: CommentInput }> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid", ok: false };
  const body = cleanBody(parsed.data.body);
  if (body.length < 2 || body.length > 1000) return { error: "invalid", ok: false };
  return { ok: true, value: { ...parsed.data, body } };
}

export function parseCommentFlagReason(value: unknown): CommentFlagReason | null {
  return typeof value === "string" && value in commentFlagReasons
    ? (value as CommentFlagReason)
    : null;
}
