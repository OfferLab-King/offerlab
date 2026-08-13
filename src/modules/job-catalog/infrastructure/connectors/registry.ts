import type { JobSource, SourceType } from "../../domain/source";
import { JobFetchError } from "./errors";
import { createAshbyConnector } from "./ashby";
import { createBrowserHtmlConnector } from "./browser-html";
import { createGenericHtmlConnector } from "./generic-html";
import { createGreenhouseConnector } from "./greenhouse";
import { createLeverConnector } from "./lever";
import { createSmartRecruitersConnector } from "./smartrecruiters";
import { createWorkdayConnector } from "./workday";
import type { JobSourceConnector } from "./types";

const connectors = new Map<SourceType, () => JobSourceConnector>([
  ["greenhouse", createGreenhouseConnector],
  ["lever", createLeverConnector],
  ["ashby", createAshbyConnector],
  ["smartrecruiters", createSmartRecruitersConnector],
  ["workday", createWorkdayConnector],
  ["direct_html", createGenericHtmlConnector],
  ["custom", createGenericHtmlConnector],
]);

export function createConnectorForSource(source: JobSource): JobSourceConnector {
  if (source.needsBrowser) {
    return createBrowserHtmlConnector();
  }
  const factory = connectors.get(source.sourceType);
  if (!factory) {
    throw new JobFetchError("unsupported", `no connector for source type ${source.sourceType}`);
  }
  return factory();
}
