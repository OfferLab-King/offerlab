import type {
  AdminResource,
  CategoryOption,
  TaxonomyRecord,
} from "../../../modules/preparation-resources/application/admin-content";
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
  return (
    <>
      <label>
        Title (required to publish)
        <input defaultValue={resource?.title} maxLength={160} name="title" />
      </label>
      <label>
        Slug (required)
        <input
          defaultValue={resource?.slug}
          maxLength={120}
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        Short description (required to publish)
        <textarea
          defaultValue={resource?.shortDescription}
          maxLength={500}
          name="shortDescription"
        />
      </label>
      <label>
        Type
        <select defaultValue={resource?.resourceType ?? "guide"} name="resourceType">
          {["guide", "checklist", "template", "video", "exercise", "article", "coaching_case"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Access
        <select defaultValue={resource?.accessLevel ?? "member"} name="accessLevel">
          <option value="public">public</option>
          <option value="member">member</option>
        </select>
      </label>
      <label>
        Primary category
        <select defaultValue={resource?.primaryCategoryId ?? ""} name="primaryCategoryId">
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Tags</legend>
        {tags.map((tag) => (
          <label key={tag.id}>
            <input
              defaultChecked={resource?.tagIds.includes(tag.id)}
              disabled={!!tag.archivedAt && !resource?.tagIds.includes(tag.id)}
              name="tagIds"
              type="checkbox"
              value={tag.id}
            />{" "}
            {tag.name}
            {tag.archivedAt ? " (archived)" : ""}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Recruitment stages</legend>
        {[
          "preparing",
          "applied",
          "online_assessment",
          "video_interview",
          "interview",
          "assessment_centre",
          "offer",
          "rejected",
          "withdrawn",
        ].map((stage) => (
          <label key={stage}>
            <input
              defaultChecked={resource?.stages.includes(stage)}
              name="stages"
              type="checkbox"
              value={stage}
            />{" "}
            {stage.replaceAll("_", " ")}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Opportunity types</legend>
        {["graduate_scheme", "internship", "placement", "entry_level_role"].map((type) => (
          <label key={type}>
            <input
              defaultChecked={resource?.opportunityTypes.includes(type)}
              name="opportunityTypes"
              type="checkbox"
              value={type}
            />{" "}
            {type.replaceAll("_", " ")}
          </label>
        ))}
      </fieldset>
      <label>
        Related resource UUIDs (one per line, in display order; maximum 20)
        <textarea
          defaultValue={resource?.relatedResourceIds.join("\n") ?? ""}
          name="relatedResourceIds"
          rows={6}
        />
      </label>
      {resources.length > 0 && (
        <details>
          <summary>Available related-resource UUIDs</summary>
          <ul>
            {resources
              .filter((item) => item.id !== resource?.id)
              .map((item) => (
                <li key={item.id}>
                  <code>{item.id}</code> — {item.title || "Untitled"} · {item.publicationState}
                </li>
              ))}
          </ul>
        </details>
      )}
      <label>
        Controlled links (JSON array in display order)
        <textarea
          defaultValue={JSON.stringify(resource?.links ?? [], null, 2)}
          name="controlledLinks"
          rows={8}
        />
      </label>
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
        <input defaultValue={resource?.youtubeVideoId ?? ""} maxLength={2048} name="youtubeVideo" />
      </label>
      <label>
        Markdown body
        <textarea
          defaultValue={resource?.markdownBody}
          maxLength={100000}
          name="markdownBody"
          rows={18}
        />
      </label>
      <details>
        <summary>Markdown help</summary>
        <p>
          Use headings, paragraphs, lists, links, tables and code. Raw HTML and arbitrary embeds are
          not rendered.
        </p>
      </details>
    </>
  );
}
