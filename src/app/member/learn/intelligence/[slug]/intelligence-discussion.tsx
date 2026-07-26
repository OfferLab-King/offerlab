import {
  commentFlagReasons,
  communityTermsVersion,
} from "../../../../../modules/recruitment-intelligence/domain/community";
import type { IntelligenceComment } from "../../../../../modules/recruitment-intelligence/infrastructure/community-repository";
import { flagCommentAction, submitCommentAction } from "./actions";

const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function Comment({ comment, slug }: { comment: IntelligenceComment; slug: string }) {
  return (
    <article className={`discussion-comment is-${comment.moderationState}`}>
      <div className="discussion-meta">
        <strong>
          {comment.mine
            ? "Your comment"
            : comment.reportAuthor
              ? "Report contributor"
              : "OfferLab member"}
        </strong>
        <span>{formatter.format(new Date(comment.createdAt))}</span>
        {comment.moderationState !== "published" && <span>{comment.moderationState}</span>}
      </div>
      <p>{comment.body}</p>
      {comment.moderationState === "published" && !comment.mine && (
        <details className="discussion-compact-action">
          <summary>Report comment</summary>
          <form action={flagCommentAction}>
            <input name="commentId" type="hidden" value={comment.id} />
            <input name="slug" type="hidden" value={slug} />
            <label>
              Reason
              <select name="reason" required>
                {Object.entries(commentFlagReasons).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary" type="submit">
              Send report
            </button>
          </form>
        </details>
      )}
    </article>
  );
}

function Composer({
  agreementAccepted,
  parentCommentId = null,
  reportId,
  slug,
}: {
  agreementAccepted: boolean;
  parentCommentId?: string | null;
  reportId: string;
  slug: string;
}) {
  return (
    <form action={submitCommentAction} className="discussion-composer">
      <input name="parentCommentId" type="hidden" value={parentCommentId ?? ""} />
      <input name="reportId" type="hidden" value={reportId} />
      <input name="slug" type="hidden" value={slug} />
      <label>
        {parentCommentId ? "Write a reply" : "Add a comment or question"}
        <textarea
          maxLength={1000}
          minLength={2}
          name="body"
          required
          rows={parentCommentId ? 3 : 4}
        />
      </label>
      {!agreementAccepted && (
        <label className="discussion-agreement">
          <input name="agreementConfirmed" required type="checkbox" value="yes" />
          <span>
            I agree not to share personal data, confidential material, exact restricted questions or
            abusive content. Community rules version {communityTermsVersion}.
          </span>
        </label>
      )}
      <button type="submit">Submit for review</button>
    </form>
  );
}

export function IntelligenceDiscussion({
  agreementAccepted,
  comments,
  result,
  reportId,
  slug,
}: {
  agreementAccepted: boolean;
  comments: readonly IntelligenceComment[];
  result?: string;
  reportId: string;
  slug: string;
}) {
  const roots = comments.filter((comment) => !comment.parentCommentId);
  return (
    <section className="intelligence-discussion" id="discussion">
      <div className="discussion-heading">
        <div>
          <p className="eyebrow">Member discussion</p>
          <h2>Ask for context and share useful experience</h2>
        </div>
        <span>
          {comments.filter((comment) => comment.moderationState === "published").length} published
        </span>
      </div>
      <p className="discussion-guidance">
        Comments support the structured report; they do not replace it. Every comment is reviewed
        before publication and identities stay private.
      </p>
      {result === "submitted" && (
        <p className="success-summary">Your comment is awaiting moderation.</p>
      )}
      {result === "rate_limited" && (
        <p className="error-summary">You have reached the contribution limit. Try again later.</p>
      )}
      {result === "agreement_required" && (
        <p className="error-summary">Accept the community rules before contributing.</p>
      )}
      {result === "invalid" && <p className="error-summary">Check your comment and try again.</p>}
      {result === "flagged" && (
        <p className="success-summary">Thank you. The comment has been sent for review.</p>
      )}
      <Composer agreementAccepted={agreementAccepted} reportId={reportId} slug={slug} />
      <div className="discussion-thread">
        {roots.map((comment) => {
          const replies = comments.filter((reply) => reply.parentCommentId === comment.id);
          return (
            <div className="discussion-root" key={comment.id}>
              <Comment comment={comment} slug={slug} />
              {replies.length > 0 && (
                <div className="discussion-replies">
                  {replies.map((reply) => (
                    <Comment comment={reply} key={reply.id} slug={slug} />
                  ))}
                </div>
              )}
              {comment.moderationState === "published" && (
                <details className="discussion-reply-control">
                  <summary>Reply</summary>
                  <Composer
                    agreementAccepted={agreementAccepted}
                    parentCommentId={comment.id}
                    reportId={reportId}
                    slug={slug}
                  />
                </details>
              )}
            </div>
          );
        })}
        {!roots.length && (
          <p className="empty-state-copy">
            No published discussion yet. Ask the first useful question.
          </p>
        )}
      </div>
    </section>
  );
}
