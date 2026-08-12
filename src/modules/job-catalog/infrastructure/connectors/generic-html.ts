import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import { extractJobDetail, extractJobLinks, type JobListingLink } from "./html-job-extraction";
import {
  limited,
  type ConnectorContext,
  type DiscoveredJob,
  type JobSourceConnector,
} from "./types";

export const directHtmlSourceType = "direct_html" as const;
export const customSourceType = "custom" as const;

export function createGenericHtmlConnector(): JobSourceConnector {
  return {
    name: "Generic employer careers HTML",
    sourceType: directHtmlSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const careersUrl = context.company.careersUrl;
      const robotsDecision = await context.robotsGate.check(careersUrl, "offerlab-jobs-bot");
      if (robotsDecision !== "allowed") {
        throw new JobFetchError(
          "robots_blocked",
          robotsDecision === "blocked"
            ? "robots.txt disallows the careers path for our crawler user agent"
            : "robots.txt could not be verified for the careers path",
        );
      }
      const listingResponse = await fetchText(careersUrl, {
        httpClient: context.httpClient,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      const links = extractJobLinks(listingResponse.body, careersUrl);
      if (links.length === 0) {
        throw new JobFetchError("parser_changed", "no job links found on careers listing");
      }
      const detailLinks = limited(links, Math.min(context.maxDetailPages, context.maxJobs));
      const jobs: DiscoveredJob[] = [];
      for (const link of detailLinks) {
        const detailDecision = await context.robotsGate.check(link.url, "offerlab-jobs-bot");
        if (detailDecision !== "allowed") continue;
        try {
          const detailResponse = await fetchText(link.url, {
            httpClient: context.httpClient,
            headers: { accept: "text/html,application/xhtml+xml" },
          });
          jobs.push(extractJobDetail(detailResponse.body, link));
        } catch (error) {
          if (error instanceof JobFetchError && error.code === "http_404") continue;
          throw error;
        }
        if (jobs.length >= context.maxJobs) break;
      }
      return jobs;
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const robotsDecision = await context.robotsGate.check(
        context.company.careersUrl,
        "offerlab-jobs-bot",
      );
      if (robotsDecision !== "allowed") {
        throw new JobFetchError(
          "robots_blocked",
          robotsDecision === "blocked"
            ? "robots.txt disallows the careers path for our crawler user agent"
            : "robots.txt could not be verified for the careers path",
        );
      }
      const response = await fetchText(context.company.careersUrl, {
        httpClient: context.httpClient,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if (extractJobLinks(response.body, context.company.careersUrl).length === 0) {
        throw new JobFetchError("parser_changed", "no job links found on careers listing");
      }
    },
  };
}

export type { JobListingLink };
