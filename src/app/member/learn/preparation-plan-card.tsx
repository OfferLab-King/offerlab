import Link from "next/link";
import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";
import {
  planLabel,
  planStatus,
  preparationAreaPreview,
  readyAreaCount,
  showPlanProgress,
} from "./learn-presenters";

export function PreparationPlanCard({ path }: { path: MemberPath }) {
  const preview = preparationAreaPreview(path, 3);
  const status = planStatus(path);
  return (
    <article className="card path-card">
      <p className="eyebrow">{planLabel(path)}</p>
      <h3>{path.title}</h3>
      <p>{path.shortDescription}</p>
      <p className="path-card-summary">
        {path.sections.length} areas · {path.totalCount} activities
      </p>
      <div className="path-coverage" aria-label="Preparation areas">
        <ul className="area-labels">
          {preview.headings.map((heading) => (
            <li key={heading}>{heading}</li>
          ))}
        </ul>
        {preview.remaining > 0 && <span>+{preview.remaining} more</span>}
      </div>
      <div className="path-card-state">
        <strong>{status}</strong>
        {status !== "Not started" && (
          <span>
            {readyAreaCount(path)} of {path.sections.length} areas ready · {path.completedCount} of{" "}
            {path.totalCount} activities complete
          </span>
        )}
      </div>
      {showPlanProgress(path) && (
        <progress
          aria-label={`${path.title}: ${path.progress}% complete`}
          max="100"
          value={path.progress}
        />
      )}
      <Link className="button-link" href={`/member/learn/paths/${path.slug}`}>
        View plan
      </Link>
    </article>
  );
}
