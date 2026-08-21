import type { Metadata } from "next";

import type { JobDetailRow } from "../../../modules/job-catalog/application/catalog";
import { isJobIndexable } from "../../../modules/job-catalog/domain/job-indexability";
import { isPubliclyVisible } from "../../../modules/job-catalog/domain/publication";
import { jobMetaDescription, jobPageTitle } from "./job-detail-content";

export const ROLE_UNAVAILABLE_TITLE = "Role not available | OfferLab";

/**
 * Metadata policy for the public job detail route, sharing the deterministic
 * indexability predicate:
 *
 *  - missing or non-public roles: `noindex, nofollow`, no canonical and no
 *    role details leak through the title;
 *  - public but thin roles: `noindex, follow` with a clean canonical;
 *  - indexable roles: indexed, exactly one canonical, factual description.
 *
 * No query-string variant can ever become canonical.
 */
export function buildJobDetailMetadata(job: JobDetailRow | null, now: Date): Metadata {
  if (!job || !isPubliclyVisible(job, now)) {
    return {
      openGraph: { images: [], title: ROLE_UNAVAILABLE_TITLE },
      robots: { index: false, follow: false },
      title: ROLE_UNAVAILABLE_TITLE,
      twitter: { images: [], title: ROLE_UNAVAILABLE_TITLE },
    };
  }
  const title = jobPageTitle(job);
  const description = jobMetaDescription(job);
  if (!isJobIndexable(job, now)) {
    return {
      alternates: { canonical: `/jobs/${job.slug}` },
      description,
      openGraph: { description, images: [], title, type: "website" },
      robots: { index: false, follow: true },
      title,
      twitter: { description, images: [], title },
    };
  }
  return {
    alternates: { canonical: `/jobs/${job.slug}` },
    description,
    openGraph: { description, images: [], title, type: "website" },
    title,
    twitter: { description, images: [], title },
  };
}
