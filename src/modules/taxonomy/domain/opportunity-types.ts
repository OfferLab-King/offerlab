export const opportunityTypes = {
  graduate_scheme: "Graduate scheme",
  internship: "Internship",
  placement: "Placement year",
  entry_level_role: "Entry-level role",
} as const;

export type OpportunityType = keyof typeof opportunityTypes;
