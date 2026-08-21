import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResourceContent } from "../../components/resource-content";
import { SiteHeader } from "../../components/site-header";
import { readPublicResource } from "../../../modules/preparation-resources/application/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pageTitle(resource: Awaited<ReturnType<typeof readPublicResource>>): string {
  return `${resource?.title ?? "Preparation resource"} | OfferLab`;
}

function pageDescription(resource: Awaited<ReturnType<typeof readPublicResource>>): string {
  return resource?.shortDescription
    ? resource.shortDescription.length > 158
      ? `${resource.shortDescription.slice(0, 155)}…`
      : resource.shortDescription
    : "Concise preparation guidance for UK graduate recruitment.";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resource = await readPublicResource((await params).slug);
  if (!resource) {
    const title = "Resource not available | OfferLab";
    return {
      openGraph: { images: [], title },
      robots: { index: false, follow: false },
      title,
      twitter: { images: [], title },
    };
  }
  const title = pageTitle(resource);
  const description = pageDescription(resource);
  return {
    alternates: { canonical: `/learn/${resource.slug}` },
    description,
    openGraph: { description, images: [], title, type: "article" },
    title,
    twitter: { description, images: [], title },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const r = await readPublicResource((await params).slug);
  if (!r) notFound();
  return (
    <>
      <SiteHeader />
      <main className="public-resource">
        <nav aria-label="Resource trail" className="public-breadcrumb">
          <Link href="/learn">All preparation resources</Link>
          <span aria-hidden="true">/</span>
          <span>{r.title}</span>
        </nav>
        <ResourceContent resource={r} />
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
