import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResourceRecord } from "../../modules/preparation-resources/infrastructure/resource-repository";
import { isSafeMarkdownHref } from "../../modules/preparation-resources/domain/resource";

export type ResourceEditorSection = "body" | "introduction" | "media";

type ResourceContentView = Pick<
  ResourceRecord,
  | "categoryName"
  | "estimatedMinutes"
  | "links"
  | "markdownBody"
  | "relatedResources"
  | "resourceType"
  | "shortDescription"
  | "title"
  | "youtubeVideoId"
>;

type EditorControls = Readonly<{
  activeSection: ResourceEditorSection;
  onSelect: (section: ResourceEditorSection) => void;
}>;

function EditRegion({
  children,
  controls,
  label,
  section,
}: {
  children: React.ReactNode;
  controls?: EditorControls | undefined;
  label: string;
  section: ResourceEditorSection;
}) {
  if (!controls) return children;
  return (
    <section
      className={`cms-preview-region${controls.activeSection === section ? " is-active" : ""}`}
      data-editor-region={section}
    >
      <button
        aria-label={`Edit ${label}`}
        className="cms-preview-region-action"
        onClick={() => controls.onSelect(section)}
        type="button"
      >
        Edit {label}
      </button>
      {children}
    </section>
  );
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, ...props }) => {
            const safe = href && isSafeMarkdownHref(href);
            if (!safe) return <span>{props.children}</span>;
            return href.startsWith("/") ? (
              <Link href={href as never}>{props.children}</Link>
            ) : (
              <a {...props} href={href} rel="noopener noreferrer" target="_blank" />
            );
          },
          img: ({ alt }) => <span>{alt ?? "Image omitted"}</span>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function ResourceContent({
  editor,
  resource,
}: {
  editor?: EditorControls;
  resource: ResourceContentView;
}) {
  return (
    <article className="resource-content">
      <EditRegion controls={editor} label="title and summary" section="introduction">
        <p className="eyebrow">
          {resource.resourceType.replaceAll("_", " ")} · {resource.categoryName}
        </p>
        <h1>{resource.title || "Untitled content"}</h1>
        <p className="intro">
          {resource.shortDescription || "Add a short description for members."}
        </p>
      </EditRegion>
      <EditRegion controls={editor} label="media and timing" section="media">
        {resource.estimatedMinutes ? (
          <p>{resource.estimatedMinutes} minutes</p>
        ) : (
          editor && <p className="cms-preview-placeholder">No estimated time added.</p>
        )}
        {resource.youtubeVideoId ? (
          <div className="video-frame">
            <iframe
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
              src={`https://www.youtube-nocookie.com/embed/${resource.youtubeVideoId}`}
              title={`Video: ${resource.title}`}
            />
          </div>
        ) : (
          editor && <p className="cms-preview-placeholder">No video added.</p>
        )}
      </EditRegion>
      <EditRegion controls={editor} label="content body" section="body">
        {resource.markdownBody ? (
          <MarkdownContent markdown={resource.markdownBody} />
        ) : (
          editor && (
            <div className="cms-preview-placeholder cms-preview-body-placeholder">
              Add the main content. Headings, paragraphs, lists and tables will render here exactly
              as members will see them.
            </div>
          )
        )}
      </EditRegion>
      {resource.links.length > 0 && (
        <section>
          <h2>Links and downloads</h2>
          <ul>
            {resource.links.map((link, index) => (
              <li key={`${link.type}-${link.url}-${index}`}>
                {link.url.startsWith("/") ? (
                  <Link href={link.url as never}>{link.label}</Link>
                ) : (
                  <a href={link.url} rel="noopener noreferrer" target="_blank">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {resource.relatedResources.length > 0 && (
        <section>
          <h2>Related resources</h2>
          <ol>
            {resource.relatedResources.map((related) => (
              <li key={related.slug}>
                <Link
                  href={
                    `${related.accessLevel === "member" ? "/member" : ""}/learn/${related.slug}` as never
                  }
                >
                  {related.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
