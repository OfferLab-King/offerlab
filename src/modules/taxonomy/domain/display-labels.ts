import { recruitmentStages } from "../../applications/domain/application";
import { resourceTypeLabels } from "../../preparation-resources/domain/resource";
import { opportunityTypes } from "./opportunity-types";

export function recruitmentStageLabel(value: string): string {
  return recruitmentStages[value as keyof typeof recruitmentStages] ?? value;
}

export function opportunityTypeLabel(value: string): string {
  return opportunityTypes[value as keyof typeof opportunityTypes] ?? value;
}

export function resourceTypeLabel(value: string): string {
  return resourceTypeLabels[value as keyof typeof resourceTypeLabels] ?? value;
}
