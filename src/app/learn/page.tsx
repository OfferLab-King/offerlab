import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "../components/site-header";
import { readPublicResourceList } from "../../modules/preparation-resources/application/resources";
import type { ResourceRecord } from "../../modules/preparation-resources/infrastructure/resource-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/learn" },
  description:
    "Free, concise preparation resources for UK graduate recruitment: application guidance, interview technique, assessment centres and more.",
  openGraph: {
    description:
      "Free, concise preparation resources for UK graduate recruitment: application guidance, interview technique, assessment centres and more.",
    title: "Preparation resources | OfferLab",
    type: "website",
  },
  title: "Preparation resources | OfferLab",
};

export default async function PublicLearnIndexPage() {
  const resources = await readPublicResourceList();

  return (
    <>
      <SiteHeader />
      <main className="public-resource">
        <section className="section-introduction">
          <p className="eyebrow">Free preparation guidance</p>
          <h1>Preparation resources</h1>
          <p>
            Concise, plain-language guidance for UK graduate recruitment, from applications and
            online tests to video interviews and assessment centres.
          </p>
        </section>
        {resources.length === 0 ? (
          <p>New resources are being prepared. Check back soon.</p>
        ) : (
          <ul className="public-resource-list">
            {resources.map((resource: ResourceRecord) => (
              <li key={resource.slug}>
                <article className="card">
                  <p className="eyebrow">
                    {resource.resourceType.replaceAll("_", " ")} · {resource.categoryName}
                  </p>
                  <h2>
                    <Link href={`/learn/${resource.slug}`}>{resource.title}</Link>
                  </h2>
                  {resource.shortDescription && <p>{resource.shortDescription}</p>}
                  {resource.estimatedMinutes && (
                    <p className="public-resource-minutes">{resource.estimatedMinutes} minutes</p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
        <footer className="marketing-footer">
          <Link className="brand" href="/">
            OfferLab
          </Link>
          <p>Practical preparation for UK graduate recruitment.</p>
          <Link href="/jobs">Jobs</Link>
          <Link href="/employers">Employers</Link>
          <Link href="/learn">Preparation resources</Link>
          <Link href="/plans">Plans</Link>
        </footer>
      </main>
    </>
  );
}
