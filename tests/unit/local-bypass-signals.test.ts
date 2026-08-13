import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import {
  LocalBypassShutdownRequested,
  watchLocalBypassShutdown,
  type LocalBypassSignalSource,
} from "../../scripts/local-bypass-signals";

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
});
