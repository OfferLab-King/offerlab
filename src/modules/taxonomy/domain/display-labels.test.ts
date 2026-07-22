import { describe, expect, it } from "vitest";
import { opportunityTypeLabel, recruitmentStageLabel, resourceTypeLabel } from "./display-labels";

describe("member-facing taxonomy labels", () => {
  it("renders representative controlled keys as readable labels", () => {
    expect(recruitmentStageLabel("video_interview")).toBe("Video interview");
    expect(recruitmentStageLabel("online_assessment")).toBe("Online assessment");
    expect(recruitmentStageLabel("assessment_centre")).toBe("Assessment centre");
    expect(opportunityTypeLabel("graduate_scheme")).toBe("Graduate scheme");
    expect(resourceTypeLabel("checklist")).toBe("Checklist");
  });
});
