import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CrawlPoller,
  MINIMUM_POLL_INTERVAL_MS,
  readPollIntervalMs,
} from "../../../scripts/dev-jobs/poller";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("condition not met in time");
    await sleep(5);
  }
}

describe("CrawlPoller", () => {
  afterEach(() => vi.restoreAllMocks());

  it("polls on an interval without ever overlapping polls", async () => {
    const releases: (() => void)[] = [];
    let active = 0;
    let maxActive = 0;
    let polls = 0;
    const worker = vi.fn(async () => {
      polls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
    });

    const poller = new CrawlPoller({ intervalMs: 5, worker });
    void poller.start();

    await waitFor(() => polls === 1);
    await sleep(40);
    expect(polls).toBe(1);
    expect(maxActive).toBe(1);

    releases[0]!();
    await waitFor(() => polls === 2);
    await sleep(30);
    expect(polls).toBe(2);
    expect(maxActive).toBe(1);

    releases[1]!();
    await poller.stop();
  });

  it("reports the in-flight poll and continues after a failed poll", async () => {
    const worker = vi
      .fn()
      .mockRejectedValueOnce(new Error("poll failed"))
      .mockResolvedValue(undefined);
    const onError = vi.fn();

    const poller = new CrawlPoller({ intervalMs: 5, worker, onError });
    void poller.start();

    await waitFor(() => worker.mock.calls.length >= 2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "poll failed" }));

    await poller.stop();
  });

  it("stops the polling loop on stop()", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const poller = new CrawlPoller({ intervalMs: 5, worker });
    void poller.start();

    await waitFor(() => worker.mock.calls.length >= 2);
    await poller.stop();

    const callsAfterStop = worker.mock.calls.length;
    await sleep(30);
    expect(worker.mock.calls.length).toBe(callsAfterStop);
  });

  it("waits for the in-flight poll before finishing stop()", async () => {
    const releases: (() => void)[] = [];
    let active = 0;
    const worker = vi.fn(async () => {
      active += 1;
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
    });

    const poller = new CrawlPoller({ intervalMs: 5, worker });
    void poller.start();
    await waitFor(() => releases.length === 1);

    const stopped = poller.stop();
    await sleep(30);
    expect(active).toBe(1);

    releases[0]!();
    await stopped;
    expect(active).toBe(0);
  });
});

describe("readPollIntervalMs", () => {
  it("defaults to five seconds", () => {
    expect(readPollIntervalMs({})).toBe(5_000);
  });

  it("accepts an explicit interval", () => {
    expect(readPollIntervalMs({ JOB_LOCAL_WORKER_POLL_INTERVAL_MS: "2500" })).toBe(2_500);
  });

  it("enforces a minimum interval to avoid high-frequency crawling", () => {
    expect(MINIMUM_POLL_INTERVAL_MS).toBe(1_000);
    expect(readPollIntervalMs({ JOB_LOCAL_WORKER_POLL_INTERVAL_MS: "300" })).toBe(1_000);
    expect(readPollIntervalMs({ JOB_LOCAL_WORKER_POLL_INTERVAL_MS: "1" })).toBe(1_000);
  });

  it.each([
    ["0", 5_000],
    ["-5000", 5_000],
    ["not-a-number", 5_000],
    ["", 5_000],
  ])("falls back to the default for invalid value %s", (value, expected) => {
    expect(readPollIntervalMs({ JOB_LOCAL_WORKER_POLL_INTERVAL_MS: value })).toBe(expected);
  });
});
