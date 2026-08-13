import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LocalBypassShutdownRequested,
  waitForLocalBypassChildClose,
  watchLocalBypassShutdown,
  type LocalBypassSignalSource,
} from "../../scripts/local-bypass-signals";

class FakeChild extends EventEmitter {
  readonly kill = vi.fn(() => true);
  pid: number | undefined = 1234;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("local bypass signal watcher", () => {
  it("holds setup and cleanup signals until the watcher closes", () => {
    const signals = new EventEmitter() as LocalBypassSignalSource & EventEmitter;
    const shutdown = watchLocalBypassShutdown(signals);

    expect(signals.listenerCount("SIGINT")).toBe(1);
    expect(signals.listenerCount("SIGTERM")).toBe(1);
    signals.emit("SIGTERM");
    expect(shutdown.requestedSignal).toBe("SIGTERM");
    expect(() => shutdown.throwIfRequested()).toThrow(new LocalBypassShutdownRequested("SIGTERM"));
    expect(signals.listenerCount("SIGTERM")).toBe(1);

    shutdown.close();
    expect(signals.listenerCount("SIGINT")).toBe(0);
    expect(signals.listenerCount("SIGTERM")).toBe(0);
  });

  it("forwards a pending setup signal when the child attaches and detaches cleanly", () => {
    const signals = new EventEmitter() as LocalBypassSignalSource & EventEmitter;
    const killProcessGroup = vi.fn();
    const child = new FakeChild();
    const shutdown = watchLocalBypassShutdown(signals, { killProcessGroup });
    signals.emit("SIGINT");

    shutdown.attachChild(child as unknown as ChildProcess);
    expect(killProcessGroup).toHaveBeenCalledWith(-1234, "SIGINT");
    shutdown.detachChild(child as unknown as ChildProcess);
    shutdown.stopChild("SIGTERM");
    expect(killProcessGroup).toHaveBeenCalledTimes(1);
    shutdown.close();
  });

  it("records forwarding failure and escalates without treating it as child closure", async () => {
    vi.useFakeTimers();
    const signals = new EventEmitter() as LocalBypassSignalSource & EventEmitter;
    const child = new FakeChild();
    child.kill.mockReturnValue(false);
    const shutdown = watchLocalBypassShutdown(signals, {
      escalationDelayMs: 10,
      killProcessGroup: vi.fn(() => {
        throw new Error("group signal failed");
      }),
    });
    shutdown.attachChild(child as unknown as ChildProcess);
    const closed = waitForLocalBypassChildClose(child as unknown as ChildProcess);
    let settled = false;
    void closed.finally(() => {
      settled = true;
    });

    signals.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(25);
    expect(settled).toBe(false);
    expect(shutdown.forwardingFailures).toHaveLength(3);
    expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(child.kill).toHaveBeenNthCalledWith(2, "SIGTERM");
    expect(child.kill).toHaveBeenNthCalledWith(3, "SIGKILL");

    child.emit("close", null, "SIGKILL");
    await expect(closed).resolves.toEqual({ code: null, signal: "SIGKILL", errors: [] });
    shutdown.detachChild(child as unknown as ChildProcess);
    shutdown.close();
  });

  it("records a post-spawn error but waits for definitive close", async () => {
    const child = new FakeChild();
    const closed = waitForLocalBypassChildClose(child as unknown as ChildProcess);
    let settled = false;
    void closed.finally(() => {
      settled = true;
    });

    child.emit("error", new Error("signal delivery failed"));
    await Promise.resolve();
    expect(settled).toBe(false);
    child.emit("close", 0, null);
    await expect(closed).resolves.toEqual({
      code: 0,
      signal: null,
      errors: [new Error("signal delivery failed")],
    });
  });

  it("distinguishes spawn failure after the child closes", async () => {
    const child = new FakeChild();
    child.pid = undefined;
    const closed = waitForLocalBypassChildClose(child as unknown as ChildProcess);
    child.emit("error", new Error("ENOENT"));
    child.emit("close", -2, null);

    await expect(closed).rejects.toThrow("failed to start: ENOENT");
  });
});
