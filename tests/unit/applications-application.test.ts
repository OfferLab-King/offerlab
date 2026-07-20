import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  withUser: vi.fn(),
}));

vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: mocks.capture,
}));
vi.mock("../../src/infrastructure/database/runtime-connections", () => ({
  withApplicationUser: mocks.withUser,
}));
vi.mock("../../src/modules/applications/infrastructure/application-repository", async () => ({
  createApplication: mocks.create,
  findApplication: vi.fn(),
  listApplications: vi.fn(),
  setApplicationArchived: vi.fn(),
  updateApplication: mocks.update,
}));

import {
  addApplication,
  editApplication,
} from "../../src/modules/applications/application/applications";

const input = {
  appliedDate: null,
  applicationDeadline: null,
  company: "Example Plc",
  industry: null,
  location: null,
  nextStageDeadline: null,
  notes: null,
  opportunityType: "graduate_scheme",
  role: "Graduate Analyst",
  stage: "preparing",
};

describe("application analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withUser.mockImplementation(
      async (_owner: string, operation: (database: unknown) => Promise<unknown>) =>
        operation({ transaction: true }),
    );
  });

  it.each([
    ["created", "application_created"],
    ["updated", "application_updated"],
    ["stage_changed", "application_stage_changed"],
  ] as const)("captures property-free %s only after commit", async (outcome, event) => {
    const result = { application: { id: "application" }, outcome };
    if (outcome === "created") {
      mocks.create.mockResolvedValue(result);
      await addApplication("owner", input);
    } else {
      mocks.update.mockResolvedValue(result);
      await editApplication("owner", "application", { ...input, version: 1 });
    }
    expect(mocks.capture).toHaveBeenCalledOnce();
    expect(mocks.capture).toHaveBeenCalledWith(event);
  });

  it("does not capture unchanged, conflict, failed persistence, or failed commit", async () => {
    mocks.update.mockResolvedValue({ application: {}, outcome: "unchanged" });
    await editApplication("owner", "application", { ...input, version: 1 });
    mocks.update.mockResolvedValue({ current: {}, outcome: "conflict" });
    await editApplication("owner", "application", { ...input, version: 1 });
    mocks.update.mockRejectedValueOnce(new Error("write failed"));
    await expect(editApplication("owner", "application", { ...input, version: 1 })).rejects.toThrow(
      "write failed",
    );
    mocks.update.mockResolvedValueOnce({ application: {}, outcome: "updated" });
    mocks.withUser.mockImplementationOnce(
      async (_owner: string, operation: (database: unknown) => Promise<unknown>) => {
        await operation({ transaction: true });
        throw new Error("commit failed");
      },
    );
    await expect(editApplication("owner", "application", { ...input, version: 1 })).rejects.toThrow(
      "commit failed",
    );
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
