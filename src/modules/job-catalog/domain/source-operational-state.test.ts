import { describe, expect, it } from "vitest";

import {
  canRequestRun,
  deriveSourceOperationalState,
  type LatestSourceRun,
} from "./source-operational-state";

function run(overrides: Partial<LatestSourceRun> = {}): LatestSourceRun {
  return {
    status: "succeeded",
    startedAt: new Date("2026-08-12T09:00:00.000Z"),
    finishedAt: new Date("2026-08-12T09:02:00.000Z"),
    jobsDeactivated: 0,
    jobsDiscovered: 12,
    jobsNew: 3,
    jobsUnchanged: 8,
    jobsUpdated: 1,
    errorSummary: null,
    ...overrides,
  };
}

describe("deriveSourceOperationalState", () => {
  it("is ready with no result when active, not requested and never run", () => {
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: null,
      latestRun: null,
    });
    expect(state).toEqual({ kind: "ready", latest: null });
    expect(canRequestRun(state)).toBe(true);
  });

  it("is ready with a succeeded latest result including its counts", () => {
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: null,
      latestRun: run(),
    });
    expect(state).toMatchObject({
      kind: "ready",
      latest: {
        kind: "succeeded",
        errorCode: null,
        finishedAt: new Date("2026-08-12T09:02:00.000Z"),
        jobsDeactivated: 0,
        jobsDiscovered: 12,
        jobsNew: 3,
        jobsUnchanged: 8,
        jobsUpdated: 1,
      },
    });
    expect(canRequestRun(state)).toBe(true);
  });

  it("is ready with a failed latest result exposing the concise error code", () => {
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: null,
      latestRun: run({ errorSummary: "network_timeout", status: "failed" }),
    });
    expect(state).toMatchObject({
      kind: "ready",
      latest: { kind: "failed", errorCode: "network_timeout" },
    });
    expect(canRequestRun(state)).toBe(true);
  });

  it("is queued while a manual run request is pending and refuses new requests", () => {
    const requestedAt = new Date("2026-08-12T10:00:00.000Z");
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: requestedAt,
      latestRun: null,
    });
    expect(state).toEqual({ kind: "queued", requestedAt });
    expect(canRequestRun(state)).toBe(false);
  });

  it("is running when the latest ingestion run is active", () => {
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: null,
      latestRun: run({ finishedAt: null, status: "running" }),
    });
    expect(state).toEqual({ kind: "running", startedAt: run().startedAt });
    expect(canRequestRun(state)).toBe(false);
  });

  it("prefers running over queued while work is in progress", () => {
    const state = deriveSourceOperationalState({
      status: "active",
      runRequestedAt: new Date("2026-08-12T10:00:00.000Z"),
      latestRun: run({ finishedAt: null, status: "running" }),
    });
    expect(state).toEqual({ kind: "running", startedAt: new Date("2026-08-12T09:00:00.000Z") });
    expect(canRequestRun(state)).toBe(false);
  });

  it("is paused with no runnable action even when a request or run exists", () => {
    const state = deriveSourceOperationalState({
      status: "paused",
      runRequestedAt: new Date("2026-08-12T10:00:00.000Z"),
      latestRun: run({ finishedAt: null, status: "running" }),
    });
    expect(state).toEqual({ kind: "paused" });
    expect(canRequestRun(state)).toBe(false);
  });

  it("is archived with no runnable action", () => {
    const state = deriveSourceOperationalState({
      status: "archived",
      runRequestedAt: null,
      latestRun: run(),
    });
    expect(state).toEqual({ kind: "archived" });
    expect(canRequestRun(state)).toBe(false);
  });

  it("ignores skipped or unfinished runs as latest results", () => {
    expect(
      readyState({
        status: "active",
        runRequestedAt: null,
        latestRun: run({ status: "skipped" }),
      }).latest,
    ).toBeNull();
    expect(
      readyState({
        status: "active",
        runRequestedAt: null,
        latestRun: run({ finishedAt: null, status: "succeeded" }),
      }).latest,
    ).toBeNull();
  });
});

function readyState(input: Parameters<typeof deriveSourceOperationalState>[0]) {
  const state = deriveSourceOperationalState(input);
  if (state.kind !== "ready") throw new Error("expected a ready state");
  return state;
}
