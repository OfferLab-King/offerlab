"use client";
import { useState } from "react";
type SectionInput = {
  description: string;
  heading: string;
  items: readonly { contextNote: string; resourceId: string }[];
};
type Section = {
  description: string;
  heading: string;
  items: { contextNote: string; resourceId: string }[];
};
type Resource = { id: string; publicationState: string; title: string };
export function PathEditor({
  action,
  categories,
  initial,
  resources,
  version,
  publicationState = "draft",
}: {
  action: (form: FormData) => Promise<void>;
  categories: readonly { id: string; name: string }[];
  initial: {
    introduction: string;
    primaryCategoryId: string | null;
    sections: readonly SectionInput[];
    shortDescription: string;
    slug: string;
    title: string;
  };
  resources: readonly Resource[];
  version?: number;
  publicationState?: "archived" | "draft" | "published";
}) {
  const [sections, setSections] = useState<Section[]>(
    initial.sections.map((section) => ({ ...section, items: [...section.items] })),
  );
  const update = (next: Section[]) => setSections(next);
  const move = <T,>(values: T[], index: number, delta: number) => {
    const next = [...values];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  };
  return (
    <form action={action} className="application-form path-editor cms-resource-form">
      <input name="expectedVersion" type="hidden" value={version ?? 1} />
      <input name="sections" type="hidden" value={JSON.stringify(sections)} />
      <fieldset className="cms-editor-card">
        <legend>Path details</legend>
        <label>
          Title
          <input defaultValue={initial.title} maxLength={160} name="title" required={false} />
        </label>
        <label>
          Slug
          <input
            defaultValue={initial.slug}
            maxLength={120}
            name="slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
        </label>
        <label>
          Description
          <textarea
            defaultValue={initial.shortDescription}
            maxLength={500}
            name="shortDescription"
            rows={3}
          />
        </label>
        <label>
          Introduction (Markdown)
          <textarea
            defaultValue={initial.introduction}
            maxLength={50000}
            name="introduction"
            rows={8}
          />
        </label>
        <label>
          Primary category
          <select defaultValue={initial.primaryCategoryId ?? ""} name="primaryCategoryId">
            <option value="">No primary category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <section aria-labelledby="structure-heading" className="cms-editor-card">
        <div className="cms-section-heading">
          <h2 id="structure-heading">Sections and resources</h2>
          <button
            className="button-secondary"
            onClick={() => update([...sections, { description: "", heading: "", items: [] }])}
            type="button"
          >
            Add section
          </button>
        </div>
        {sections.length === 0 && (
          <p className="status">Drafts may be incomplete. Add a section before publishing.</p>
        )}
        {sections.map((section, sectionIndex) => (
          <fieldset className="cms-link-row path-editor-section" key={sectionIndex}>
            <legend>Section {sectionIndex + 1}</legend>
            <div className="move-controls">
              <button
                aria-label={`Move section ${sectionIndex + 1} up`}
                disabled={sectionIndex === 0}
                onClick={() => update(move(sections, sectionIndex, -1))}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move section ${sectionIndex + 1} down`}
                disabled={sectionIndex === sections.length - 1}
                onClick={() => update(move(sections, sectionIndex, 1))}
                type="button"
              >
                ↓
              </button>
              <button
                className="button-secondary"
                onClick={() => update(sections.filter((_, index) => index !== sectionIndex))}
                type="button"
              >
                Remove section
              </button>
            </div>
            <label>
              Heading
              <input
                maxLength={120}
                onChange={(event) =>
                  update(
                    sections.map((value, index) =>
                      index === sectionIndex ? { ...value, heading: event.target.value } : value,
                    ),
                  )
                }
                value={section.heading}
              />
            </label>
            <label>
              Short description
              <textarea
                maxLength={500}
                onChange={(event) =>
                  update(
                    sections.map((value, index) =>
                      index === sectionIndex
                        ? { ...value, description: event.target.value }
                        : value,
                    ),
                  )
                }
                rows={2}
                value={section.description}
              />
            </label>
            <ol className="editor-items">
              {section.items.map((item, itemIndex) => (
                <li key={`${item.resourceId}-${itemIndex}`}>
                  <select
                    aria-label={`Resource ${itemIndex + 1}`}
                    onChange={(event) =>
                      update(
                        sections.map((value, index) =>
                          index === sectionIndex
                            ? {
                                ...value,
                                items: value.items.map((entry, inner) =>
                                  inner === itemIndex
                                    ? { ...entry, resourceId: event.target.value }
                                    : entry,
                                ),
                              }
                            : value,
                        ),
                      )
                    }
                    value={item.resourceId}
                  >
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.title || "Untitled"} ({resource.publicationState})
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Context note for resource ${itemIndex + 1}`}
                    maxLength={500}
                    onChange={(event) =>
                      update(
                        sections.map((value, index) =>
                          index === sectionIndex
                            ? {
                                ...value,
                                items: value.items.map((entry, inner) =>
                                  inner === itemIndex
                                    ? { ...entry, contextNote: event.target.value }
                                    : entry,
                                ),
                              }
                            : value,
                        ),
                      )
                    }
                    placeholder="Optional context note"
                    value={item.contextNote}
                  />
                  <div className="move-controls">
                    <button
                      aria-label={`Move resource ${itemIndex + 1} up`}
                      disabled={itemIndex === 0}
                      onClick={() =>
                        update(
                          sections.map((value, index) =>
                            index === sectionIndex
                              ? { ...value, items: move(value.items, itemIndex, -1) }
                              : value,
                          ),
                        )
                      }
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move resource ${itemIndex + 1} down`}
                      disabled={itemIndex === section.items.length - 1}
                      onClick={() =>
                        update(
                          sections.map((value, index) =>
                            index === sectionIndex
                              ? { ...value, items: move(value.items, itemIndex, 1) }
                              : value,
                          ),
                        )
                      }
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() =>
                        update(
                          sections.map((value, index) =>
                            index === sectionIndex
                              ? {
                                  ...value,
                                  items: value.items.filter((_, inner) => inner !== itemIndex),
                                }
                              : value,
                          ),
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button
              className="button-secondary"
              disabled={!resources.length}
              onClick={() =>
                update(
                  sections.map((value, index) =>
                    index === sectionIndex
                      ? {
                          ...value,
                          items: [
                            ...value.items,
                            { contextNote: "", resourceId: resources[0]!.id },
                          ],
                        }
                      : value,
                  ),
                )
              }
              type="button"
            >
              Add resource
            </button>
          </fieldset>
        ))}
      </section>
      <div className="form-actions cms-sticky-actions">
        {publicationState !== "archived" && (
          <button name="intent" value="save">
            Save {publicationState === "published" ? "changes" : "draft"}
          </button>
        )}
        {version && publicationState === "draft" && (
          <button name="intent" value="publish">
            Publish
          </button>
        )}
        {version && publicationState === "published" && (
          <button className="button-secondary" name="intent" value="unpublish">
            Unpublish
          </button>
        )}
        {version && publicationState !== "archived" && (
          <button className="button-secondary" name="intent" value="archive">
            Archive
          </button>
        )}
        {version && publicationState === "archived" && (
          <button className="button-secondary" name="intent" value="restore">
            Restore to draft
          </button>
        )}
      </div>
    </form>
  );
}
