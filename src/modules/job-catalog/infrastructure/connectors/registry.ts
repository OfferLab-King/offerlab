import type { SourceType } from "../../domain/source";
import { JobFetchError } from "./errors";
import { createAshbyConnector } from "./ashby";
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

export function createConnectorForSource(sourceType: SourceType): JobSourceConnector {
  const factory = connectors.get(sourceType);
  if (!factory) {
    throw new JobFetchError("unsupported", `no connector for source type ${sourceType}`);
  }
  return factory();
}
