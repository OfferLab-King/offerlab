import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKER_BATCH_LIMIT,
  dueWorkerCommand,
  nextDevCommand,
  readBatchLimit,
} from "../../../scripts/dev-jobs/worker-command";

describe("worker commands", () => {
  it("starts Next.js development through the repository toolchain", () => {
    expect(nextDevCommand()).toEqual({ command: "pnpm", args: ["dev"] });
  });

  it("invokes the existing due-source worker with a small batch limit", () => {
    expect(dueWorkerCommand(3)).toEqual({
      command: "pnpm",
      args: ["jobs:crawl:due", "--limit=3"],
    });
  });

  it("never composes reset, seed, migration or test commands", () => {
    const forbiddenTokens = [
      "db:reset",
      "db:seed",
      "db:new-migration",
      "seed-companies",
      "migration",
      "validate",
      "test",
    ];
    for (const request of [nextDevCommand(), dueWorkerCommand(DEFAULT_WORKER_BATCH_LIMIT)]) {
      for (const part of [request.command, ...request.args]) {
        for (const token of forbiddenTokens) {
          expect(part, `${part} must not contain ${token}`).not.toContain(token);
        }
      }
    }
  });
});

describe("readBatchLimit", () => {
  it("defaults to a small batch", () => {
    expect(DEFAULT_WORKER_BATCH_LIMIT).toBe(3);
    expect(readBatchLimit({})).toBe(3);
  });

  it("accepts a bounded override", () => {
    expect(readBatchLimit({ JOB_LOCAL_WORKER_BATCH_LIMIT: "1" })).toBe(1);
    expect(readBatchLimit({ JOB_LOCAL_WORKER_BATCH_LIMIT: "25" })).toBe(25);
  });

  it.each([
    ["0", 3],
    ["26", 3],
    ["-1", 3],
    ["two", 3],
    ["", 3],
  ])("falls back to the default for invalid value %s", (value, expected) => {
    expect(readBatchLimit({ JOB_LOCAL_WORKER_BATCH_LIMIT: value })).toBe(expected);
  });
});
