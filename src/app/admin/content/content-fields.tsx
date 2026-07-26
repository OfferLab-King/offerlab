"use client";

import { useState } from "react";
import { ResourceContent, type ResourceEditorSection } from "../../components/resource-content";
import { CoachingCaseView } from "../../member/learn/coaching-case-view";
import type {
  AdminResource,
  CategoryOption,
  ControlledLink,
  TaxonomyRecord,
} from "../../../modules/preparation-resources/application/admin-content";
import type { CoachingCaseDetail } from "../../../modules/preparation-resources/domain/coaching-case";
import { parseYouTubeVideoId } from "../../../modules/preparation-resources/domain/resource";
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

function LinksEditor({
  links,
  setLinks,
}: {
  links: ControlledLink[];
  setLinks: React.Dispatch<React.SetStateAction<ControlledLink[]>>;
}) {
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
  const [activeSection, setActiveSection] = useState<ResourceEditorSection>("introduction");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [shortDescription, setShortDescription] = useState(resource?.shortDescription ?? "");
  const [markdownBody, setMarkdownBody] = useState(resource?.markdownBody ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    resource?.estimatedMinutes?.toString() ?? "",
  );
  const [youtubeVideo, setYoutubeVideo] = useState(resource?.youtubeVideoId ?? "");
  const [primaryCategoryId, setPrimaryCategoryId] = useState(resource?.primaryCategoryId ?? "");
  const [links, setLinks] = useState<ControlledLink[]>([...(resource?.links ?? [])]);
  const [relatedResourceIds, setRelatedResourceIds] = useState<string[]>([
    ...(resource?.relatedResourceIds ?? []),
  ]);
  const [coachingCasePreview, setCoachingCasePreview] = useState<CoachingCaseDetail | null>(
    resource?.coachingCaseDetail ?? null,
  );
  const categoryName =
    categories.find((category) => category.id === primaryCategoryId)?.name ?? "Uncategorised";
  const parsedVideo = parseYouTubeVideoId(youtubeVideo);
  const previewResource = {
    categoryName,
    estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
    links: links.filter((link) => link.label && link.url),
    markdownBody,
    relatedResources: resources
      .filter((item) => relatedResourceIds.includes(item.id))
      .map((item) => ({ accessLevel: item.accessLevel, slug: item.slug, title: item.title })),
    resourceType,
    shortDescription,
    title,
    youtubeVideoId: parsedVideo,
  } as const;
  return (
    <div className="cms-editor-sections">
      <section aria-labelledby="visual-editor-title" className="cms-visual-editor">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Visual editor</p>
            <h2 id="visual-editor-title">Edit the member view</h2>
            <p>Select a region on the canvas, then edit it in the panel. Changes appear live.</p>
          </div>
          <span className="cms-required-note">
            {resource?.publicationState === "published"
              ? "Saving updates the member view"
              : "Private draft preview"}
          </span>
        </div>
        <input name="title" type="hidden" value={title} />
        <input name="shortDescription" type="hidden" value={shortDescription} />
        <input name="markdownBody" type="hidden" value={markdownBody} />
        <input name="estimatedMinutes" type="hidden" value={estimatedMinutes} />
        <input name="youtubeVideo" type="hidden" value={youtubeVideo} />
        <div className="cms-visual-workspace">
          <div
            className="cms-member-canvas"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) event.preventDefault();
            }}
          >
            <div className="cms-member-canvas-label">Member view</div>
            <ResourceContent
              editor={{ activeSection, onSelect: setActiveSection }}
              resource={previewResource}
            />
            {resourceType === "coaching_case" && coachingCasePreview && (
              <CoachingCaseView detail={coachingCasePreview} />
            )}
            {resourceType === "coaching_case" && !coachingCasePreview && (
              <p className="cms-empty-inline">
                Complete the coaching-case fields below to render the annotated member view here.
              </p>
            )}
          </div>
          <aside aria-label="Selected content block" className="cms-edit-panel">
            <div className="cms-edit-panel-tabs" role="group" aria-label="Content block">
              {(
                [
                  ["introduction", "Title and summary"],
                  ["body", "Content body"],
                  ["media", "Media and timing"],
                ] as const
              ).map(([section, sectionLabel]) => (
                <button
                  aria-pressed={activeSection === section}
                  className={activeSection === section ? "is-active" : ""}
                  key={section}
                  onClick={() => setActiveSection(section)}
                  type="button"
                >
                  {sectionLabel}
                </button>
              ))}
            </div>
            {activeSection === "introduction" && (
              <div className="cms-edit-panel-fields">
                <h3>Title and summary</h3>
                <label>
                  Title (required to publish)
                  <input
                    maxLength={160}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="A clear, specific title"
                    value={title}
                  />
                </label>
                <label>
                  Short description (required to publish)
                  <textarea
                    maxLength={500}
                    onChange={(event) => setShortDescription(event.target.value)}
                    placeholder="Tell members what they will learn or be able to do."
                    rows={2}
                    value={shortDescription}
                  />
                </label>
              </div>
            )}
            {activeSection === "body" && (
              <div className="cms-edit-panel-fields">
                <h3>Content body</h3>
                <p className="hint">
                  Use Markdown for headings, short paragraphs, lists and tables.
                </p>
                <label>
                  Markdown body
                  <textarea
                    maxLength={100000}
                    onChange={(event) => setMarkdownBody(event.target.value)}
                    placeholder="Use headings, short paragraphs and lists."
                    rows={20}
                    value={markdownBody}
                  />
                </label>
              </div>
            )}
            {activeSection === "media" && (
              <div className="cms-edit-panel-fields">
                <h3>Media and timing</h3>
                <label>
                  Estimated minutes (optional)
                  <input
                    max={600}
                    min={1}
                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                    type="number"
                    value={estimatedMinutes}
                  />
                </label>
                <label>
                  YouTube URL or ID (optional)
                  <input
                    maxLength={2048}
                    onChange={(event) => setYoutubeVideo(event.target.value)}
                    value={youtubeVideo}
                  />
                </label>
                {youtubeVideo && !parsedVideo && (
                  <p className="field-error">Enter a valid YouTube URL or video ID.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>
      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Publishing</p>
            <h2>Set the URL and content type</h2>
          </div>
          <span className="cms-required-note">Required to publish</span>
        </div>
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
            <select
              name="primaryCategoryId"
              onChange={(event) => setPrimaryCategoryId(event.target.value)}
              value={primaryCategoryId}
            >
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

      {resourceType === "coaching_case" ? (
        <CoachingCaseEditor
          detail={resource?.coachingCaseDetail}
          onPreviewChange={setCoachingCasePreview}
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
                        checked={relatedResourceIds.includes(item.id)}
                        name="relatedResourceIds"
                        onChange={(event) =>
                          setRelatedResourceIds((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
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
            <LinksEditor links={links} setLinks={setLinks} />
          </div>
        </details>
      </section>
    </div>
  );
}
