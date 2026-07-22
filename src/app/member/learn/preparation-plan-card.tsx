import Link from "next/link";
import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";
import {
  estimatedDuration,
  planAction,
  preparationAreaPreview,
  readyAreaCount,
} from "./learn-presenters";

export function PreparationPlanCard({ path }: { path: MemberPath }) {
  const preview = preparationAreaPreview(path);
  const action = planAction(path);
  return (
    <article className="card path-card">
      <p className="eyebrow">{path.categoryName ?? "Complete preparation"}</p>
      <h3>{path.title}</h3>
      <p>{path.shortDescription}</p>
      <p className="path-card-summary">
        {path.sections.length} preparation areas · {path.totalCount} activities ·{" "}
        {estimatedDuration(path.estimatedMinutes)}
      </p>
      <div className="path-coverage">
        <strong>Covers:</strong>
        <ul>
          {preview.headings.map((heading) => (
            <li key={heading}>{heading}</li>
          ))}
        </ul>
        {preview.remaining > 0 && <p>+{preview.remaining} more</p>}
      </div>
      <progress
        aria-label={`${path.title}: ${path.progress}% complete`}
        max="100"
        value={path.progress}
      />
      <p>
        {readyAreaCount(path)} of {path.sections.length} areas ready · {path.completedCount} of{" "}
        {path.totalCount} activities complete
      </p>
      <Link className="button-link" href={`/member/learn/paths/${path.slug}`}>
        {action} preparation
      </Link>
    </article>
  );
}
