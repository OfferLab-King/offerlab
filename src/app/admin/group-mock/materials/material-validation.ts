const materialFieldLabels: Record<string, string> = {
  debriefQuestions: "debrief questions (enter at least two, one per line)",
  deliverable: "required output",
  discussionMinutes: "discussion time",
  exerciseType: "exercise format",
  followUpMinutes: "follow-up time",
  informationPack: "flexible case pack",
  observerRubric: "facilitator and observer guide",
  originalityConfirmed: "originality confirmation",
  participantInstructions: "working instructions",
  preparationMinutes: "preparation time",
  problemType: "problem type",
  recommendedGroupSize: "recommended group size",
  scenario: "candidate brief",
  sector: "industry",
  skills: "skills (enter 2–8 comma-separated tags)",
  stableKey: "internal key",
  title: "title",
};

export function materialValidationMessage(fields?: string) {
  return (
    (fields ?? "")
      .split(",")
      .filter(Boolean)
      .map((field) => materialFieldLabels[field] ?? field)
      .join(", ") || "the required fields"
  );
}
