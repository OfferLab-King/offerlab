import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { parseComment, parseCommentFlagReason } from "../domain/community";
import * as repository from "../infrastructure/community-repository";

export const readIntelligenceDiscussion = (owner: string, reportId: string) =>
  withApplicationUser(owner, async (database) => ({
    agreementAccepted: await repository.hasCurrentCommunityAgreement(database, owner),
    comments: await repository.listReportDiscussion(database, owner, reportId),
  }));

export async function submitIntelligenceComment(owner: string, input: unknown) {
  const parsed = parseComment(input);
  if (!parsed.ok) return parsed;
  return withApplicationUser(owner, (database) =>
    repository.submitComment(database, owner, parsed.value),
  );
}

export async function reportIntelligenceComment(
  owner: string,
  commentId: unknown,
  reason: unknown,
) {
  const parsed = parseCommentFlagReason(reason);
  if (
    !parsed ||
    typeof commentId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(commentId)
  ) {
    return { error: "invalid", ok: false } as const;
  }
  return withApplicationUser(owner, (database) =>
    repository.flagComment(database, owner, commentId, parsed),
  );
}

export const readIntelligenceCommentsForAdmin = (administrator: string) =>
  withApplicationUser(administrator, (database) =>
    repository.listCommentsForAdmin(database, administrator),
  );

export const reviewIntelligenceComment = (
  administrator: string,
  commentId: string,
  version: number,
  state: "pending" | "published" | "rejected" | "removed",
) =>
  withApplicationUser(administrator, (database) =>
    repository.moderateComment(database, administrator, commentId, version, state),
  );

export const dismissIntelligenceCommentFlag = (administrator: string, flagId: string) =>
  withApplicationUser(administrator, (database) =>
    repository.dismissCommentFlag(database, administrator, flagId),
  );
