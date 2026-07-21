import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResourceRecord } from "../../modules/preparation-resources/infrastructure/resource-repository";
import { isSafeMarkdownHref } from "../../modules/preparation-resources/domain/resource";

export function ResourceContent({ resource }: { resource: ResourceRecord }) {
  return (
    <article className="resource-content">
      <p className="eyebrow">
        {resource.resourceType} · {resource.categoryName}
      </p>
      <h1>{resource.title}</h1>
      <p className="intro">{resource.shortDescription}</p>
      {resource.estimatedMinutes && <p>{resource.estimatedMinutes} minutes</p>}
      {resource.youtubeVideoId && (
        <div className="video-frame">
          <iframe
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            src={`https://www.youtube-nocookie.com/embed/${resource.youtubeVideoId}`}
            title={`Video: ${resource.title}`}
          />
        </div>
      )}
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
          {resource.markdownBody}
        </ReactMarkdown>
      </div>
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
