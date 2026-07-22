import Link from "next/link";
import type { ResourceRecord } from "../../../modules/preparation-resources/infrastructure/resource-repository";
import {
  recruitmentStageLabel,
  resourceTypeLabel,
} from "../../../modules/taxonomy/domain/display-labels";
import { resourceAction } from "./learn-presenters";
import { ResourceCardControls } from "./resource-card-controls";

export function ResourceCard({ resource }: { resource: ResourceRecord }) {
  const completed = Boolean(resource.completedAt);
  return (
    <article className="card resource-card">
      <div className="resource-card-meta">
        <span>{resourceTypeLabel(resource.resourceType)}</span>
        <span>{resource.categoryName}</span>
      </div>
      <h2>
        <Link href={`/member/learn/${resource.slug}`}>{resource.title}</Link>
      </h2>
      <p>{resource.shortDescription}</p>
      {resource.stages.length > 0 && (
        <p className="resource-stage">{resource.stages.map(recruitmentStageLabel).join(", ")}</p>
      )}
      {resource.estimatedMinutes ? <p>{resource.estimatedMinutes} min</p> : null}
      <div className="resource-card-footer">
        <div>
          <ResourceCardControls resourceId={resource.id} saved={Boolean(resource.savedAt)} />
          <span className="resource-status">{completed ? "Completed" : "Not started"}</span>
        </div>
        <Link className="button-link" href={`/member/learn/${resource.slug}`}>
          {resourceAction(completed)}
        </Link>
      </div>
    </article>
  );
}
