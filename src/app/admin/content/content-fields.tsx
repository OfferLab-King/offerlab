"use client";

import { useState } from "react";
import type {
  AdminResource,
  CategoryOption,
  ControlledLink,
  TaxonomyRecord,
} from "../../../modules/preparation-resources/application/admin-content";
import { CoachingCaseEditor } from "./coaching-case-editor";

const types = [
  "guide",
  "checklist",
  "template",
  "video",
  "exercise",
  "article",
  "coaching_case",
] as const;
const stages = [
  "preparing",
  "applied",
  "online_assessment",
  "video_interview",
  "interview",
  "assessment_centre",
  "offer",
  "rejected",
  "withdrawn",
] as const;
const opportunities = ["graduate_scheme", "internship", "placement", "entry_level_role"] as const;

function label(value: string) {
  return value.replaceAll("_", " ");
}

function LinksEditor({ initial }: { initial: readonly ControlledLink[] }) {
  const [links, setLinks] = useState<ControlledLink[]>([...initial]);
  return (
    <div className="cms-links-editor">
      <input name="controlledLinks" type="hidden" value={JSON.stringify(links)} />
      <div className="cms-section-heading">
        <div>
          <h3>Links and downloads</h3>
          <p>Add only links that should appear with this resource.</p>
        </div>
        <button
          className="button-secondary"
          onClick={() =>
            setLinks((current) => [...current, { label: "", type: "external", url: "" }])
          }
          type="button"
        >
          Add link
        </button>
      </div>
      {links.length === 0 ? (
        <p className="cms-empty-inline">No links added.</p>
      ) : (
        links.map((link, index) => (
          <div className="cms-link-row" key={index}>
            <label>
              Type
              <select
                aria-label={`Link ${index + 1} type`}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item, inner) =>
                      inner === index
                        ? { ...item, type: event.target.value as ControlledLink["type"] }
                        : item,
                    ),
                  )
                }
                value={link.type}
              >
                <option value="external">External link</option>
                <option value="download">Download</option>
                <option value="template_copy">Template copy</option>
              </select>
            </label>
            <label>
              Label
              <input
                aria-label={`Link ${index + 1} label`}
                maxLength={120}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item, inner) =>
                      inner === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
                value={link.label}
              />
            </label>
            <label>
              URL
              <input
                aria-label={`Link ${index + 1} URL`}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item, inner) =>
                      inner === index ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
                value={link.url}
              />
            </label>
            <button
              aria-label={`Remove link ${index + 1}`}
              className="button-danger-outline"
              onClick={() => setLinks((current) => current.filter((_, inner) => inner !== index))}
              type="button"
            >
              Remove
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function ContentFields({
  categories,
  resources = [],
  resource,
  tags = [],
}: {
  categories: readonly CategoryOption[];
  resources?: readonly AdminResource[];
  resource?: AdminResource;
  tags?: readonly TaxonomyRecord[];
}) {
  const [resourceType, setResourceType] = useState<AdminResource["resourceType"]>(
    resource?.resourceType ?? "guide",
  );
  return (
    <div className="cms-editor-sections">
      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Basics</p>
            <h2>Name and describe the content</h2>
          </div>
          <span className="cms-required-note">Required to publish</span>
        </div>
        <label>
          Title (required to publish)
          <input
            defaultValue={resource?.title}
            maxLength={160}
            name="title"
            placeholder="A clear, specific title"
          />
        </label>
        <div className="cms-field-grid">
          <label>
            Slug (required)
            <input
              defaultValue={resource?.slug}
              disabled={Boolean(resource?.firstPublishedAt)}
              maxLength={120}
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="clear-url-slug"
              required
            />
            {resource?.firstPublishedAt && (
              <>
                <input name="slug" type="hidden" value={resource.slug} />
                <span className="hint">The URL is locked after first publication.</span>
              </>
            )}
          </label>
          <label>
            Type
            <select
              name="resourceType"
              onChange={(event) =>
                setResourceType(event.target.value as AdminResource["resourceType"])
              }
              value={resourceType}
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {type === "coaching_case" ? "Annotated coaching case" : label(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Short description (required to publish)
          <textarea
            defaultValue={resource?.shortDescription}
            maxLength={500}
            name="shortDescription"
            placeholder="Tell members what they will learn or be able to do."
            rows={3}
          />
        </label>
      </section>

      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Organisation</p>
            <h2>Choose where this content appears</h2>
          </div>
        </div>
        <div className="cms-field-grid">
          <label>
            Access
            <select defaultValue={resource?.accessLevel ?? "member"} name="accessLevel">
              <option value="member">Members only</option>
              <option value="public">Public preview</option>
            </select>
          </label>
          <label>
            Primary category
            <select defaultValue={resource?.primaryCategoryId ?? ""} name="primaryCategoryId">
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option
                  disabled={Boolean(category.archivedAt)}
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                  {category.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="cms-choice-group">
          <legend>Tags</legend>
          <div className="cms-choice-grid">
            {tags.map((tag) => (
              <label className="cms-check-card" key={tag.id}>
                <input
                  defaultChecked={resource?.tagIds.includes(tag.id)}
                  disabled={!!tag.archivedAt && !resource?.tagIds.includes(tag.id)}
                  name="tagIds"
                  type="checkbox"
                  value={tag.id}
                />
                <span>
                  {tag.name}
                  {tag.archivedAt ? " (archived)" : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="cms-choice-group">
          <legend>Relevant recruitment stages</legend>
          <div className="cms-choice-grid">
            {stages.map((stage) => (
              <label className="cms-check-card" key={stage}>
                <input
                  defaultChecked={resource?.stages.includes(stage)}
                  name="stages"
                  type="checkbox"
                  value={stage}
                />
                <span>{label(stage)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="cms-choice-group">
          <legend>Opportunity types</legend>
          <div className="cms-choice-grid">
            {opportunities.map((opportunity) => (
              <label className="cms-check-card" key={opportunity}>
                <input
                  defaultChecked={resource?.opportunityTypes.includes(opportunity)}
                  name="opportunityTypes"
                  type="checkbox"
                  value={opportunity}
                />
                <span>{label(opportunity)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Content</p>
            <h2>Write the resource</h2>
            <p>
              This introduction appears above a structured coaching case, or forms the main body of
              other resources.
            </p>
          </div>
        </div>
        <label>
          Markdown body
          <textarea
            defaultValue={resource?.markdownBody}
            maxLength={100000}
            name="markdownBody"
            placeholder="Use headings, short paragraphs and lists."
            rows={16}
          />
        </label>
        <div className="cms-field-grid">
          <label>
            Estimated minutes (optional)
            <input
              defaultValue={resource?.estimatedMinutes ?? ""}
              max={600}
              min={1}
              name="estimatedMinutes"
              type="number"
            />
          </label>
          <label>
            YouTube URL or ID (optional)
            <input
              defaultValue={resource?.youtubeVideoId ?? ""}
              maxLength={2048}
              name="youtubeVideo"
            />
          </label>
        </div>
      </section>

      {resourceType === "coaching_case" ? (
        <CoachingCaseEditor
          detail={resource?.coachingCaseDetail}
          sourceKind={resource?.coachingCaseSourceKind}
        />
      ) : (
        <>
          <input name="coachingCaseDetail" type="hidden" value="" />
          <input name="coachingCaseSourceKind" type="hidden" value="synthetic" />
        </>
      )}

      <section className="cms-editor-card">
        <details>
          <summary>Related content and links</summary>
          <div className="cms-details-body">
            <fieldset className="cms-choice-group">
              <legend>Related resources</legend>
              <p>Select resources that should be suggested after this one.</p>
              <div className="cms-choice-grid cms-choice-grid-wide">
                {resources
                  .filter((item) => item.id !== resource?.id)
                  .map((item) => (
                    <label className="cms-check-card" key={item.id}>
                      <input
                        defaultChecked={resource?.relatedResourceIds.includes(item.id)}
                        name="relatedResourceIds"
                        type="checkbox"
                        value={item.id}
                      />
                      <span>
                        {item.title || "Untitled"}
                        <small>{item.publicationState}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>
            <LinksEditor initial={resource?.links ?? []} />
          </div>
        </details>
      </section>
    </div>
  );
}
