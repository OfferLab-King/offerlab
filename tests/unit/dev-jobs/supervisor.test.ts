import { EventEmitter } from "node:events";

import type { ChildProcess, SpawnOptions } from "node:child_process";
import { describe, expect, it } from "vitest";

import { DevWithJobsSupervisor } from "../../../scripts/dev-jobs/supervisor";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("condition not met in time");
    await sleep(5);
  }
}

class FakeChildProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  constructor(readonly pid: number) {
    super();
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    void signal;
    return true;
  }

  emitExit(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
}

type SpawnRecord = Readonly<{ command: string; args: readonly string[]; options: SpawnOptions }>;

function harness(options: Readonly<{ batchLimit?: number; pollEnabled?: boolean }> = {}) {
  const children: FakeChildProcess[] = [];
  const nextChildren: FakeChildProcess[] = [];
  const spawnRequests: SpawnRecord[] = [];
  const terminateCalls: { pid: number; signal: NodeJS.Signals }[] = [];
  const logs: string[] = [];
  const pollErrors: unknown[] = [];

  const spawnProcess = (command: string, args: readonly string[], options: SpawnOptions) => {
    const child = new FakeChildProcess(1_000 + spawnRequests.length);
    spawnRequests.push({ command, args, options });
    children.push(child);
    if (args[0] === "jobs:crawl:due") queueMicrotask(() => child.emitExit(0));
    if (args[0] === "dev") nextChildren.push(child);
    return child as unknown as ChildProcess;
  };

  const terminateProcess = (pid: number, signal: NodeJS.Signals) => {
    terminateCalls.push({ pid, signal });
    const child = children.find((candidate) => candidate.pid === -pid);
    child?.emitExit(null, signal);
  };

  const supervisor = new DevWithJobsSupervisor({
    spawnProcess,
    terminateProcess,
    onLog: (message) => logs.push(message),
    onPollError: (error) => pollErrors.push(error),
    pollIntervalMs: 5,
    batchLimit: options.batchLimit ?? 3,
    pollEnabled: options.pollEnabled ?? true,
    childExitTimeoutMs: 200,
  });

  return {
    supervisor,
    children,
    nextChildren,
    spawnRequests,
    terminateCalls,
    logs,
    pollErrors,
  };
}

describe("DevWithJobsSupervisor", () => {
  it("spawns only next dev and the due-source worker, detached, and exits non-zero on an unexpected next exit", async () => {
    const { supervisor, spawnRequests, nextChildren, logs } = harness();
    const runPromise = supervisor.run();

    await waitFor(() => spawnRequests.some((request) => request.args[0] === "jobs:crawl:due"));
    nextChildren[0]!.emitExit(0, null);

    expect(await runPromise).toBe(1);
    expect(spawnRequests.map((request) => request.args[0])).toContain("dev");
    expect(spawnRequests.some((request) => request.args[0] === "jobs:crawl:due")).toBe(true);
    for (const request of spawnRequests) {
      expect(request.options.detached).toBe(true);
    }
    expect(logs.some((log) => log.includes("unexpectedly"))).toBe(true);
  });

  it("passes the configured batch limit to the due worker", async () => {
    const { supervisor, spawnRequests, nextChildren } = harness({ batchLimit: 5 });
    const runPromise = supervisor.run();

    await waitFor(() => spawnRequests.some((request) => request.args[0] === "jobs:crawl:due"));
    const worker = spawnRequests.find((request) => request.args[0] === "jobs:crawl:due")!;
    expect(worker.command).toBe("pnpm");
    expect(worker.args).toEqual(["jobs:crawl:due", "--limit=5"]);

    nextChildren[0]!.emitExit(0, null);
    await runPromise;
  });

  it("never spawns reset, seed, migration or test commands", async () => {
    const { supervisor, spawnRequests, nextChildren } = harness();
    const runPromise = supervisor.run();

    await waitFor(() => spawnRequests.length >= 2);
    nextChildren[0]!.emitExit(0, null);
    await runPromise;

    const forbiddenTokens = [
      "db:reset",
      "db:seed",
      "db:new-migration",
      "seed-companies",
      "migration",
      "validate",
      "test",
    ];
    expect(spawnRequests.length).toBeGreaterThanOrEqual(2);
    for (const request of spawnRequests) {
      for (const part of [request.command, ...request.args]) {
        for (const token of forbiddenTokens) {
          expect(part, `${part} must not contain ${token}`).not.toContain(token);
        }
      }
    }
  });

  it("forwards shutdown to every child process group and stops polling", async () => {
    const { supervisor, children, terminateCalls, spawnRequests } = harness();
    void supervisor.startNextDev();
    supervisor.startPolling();

    await waitFor(() => children.length >= 2);
    const childrenAtShutdown = [...children];

    await supervisor.shutdown("SIGINT");

    for (const child of childrenAtShutdown) {
      expect(child.exitCode !== null || child.signalCode !== null, "child must be stopped").toBe(
        true,
      );
    }
    expect(terminateCalls.length).toBeGreaterThan(0);
    for (const call of terminateCalls) {
      expect(call.pid).toBeLessThan(0);
      expect(call.signal).toBe("SIGTERM");
    }

    const workerSpawnsAtShutdown = spawnRequests.filter(
      (request) => request.args[0] === "jobs:crawl:due",
    ).length;
    await sleep(40);
    const workerSpawnsLater = spawnRequests.filter(
      (request) => request.args[0] === "jobs:crawl:due",
    ).length;
    expect(workerSpawnsLater).toBe(workerSpawnsAtShutdown);
  });

  it("returns zero after a forwarded shutdown signal", async () => {
    const { supervisor, nextChildren } = harness();
    const runPromise = supervisor.run();
    const shutdownPromise = supervisor.shutdown("SIGINT");
    expect(await runPromise).toBe(0);
    await shutdownPromise;
    expect(nextChildren[0]!.exitCode !== null || nextChildren[0]!.signalCode !== null).toBe(true);
  });

  it("propagates the next dev exit code as a non-zero result", async () => {
    const { supervisor, nextChildren } = harness();
    const runPromise = supervisor.run();
    nextChildren[0]!.emitExit(7, null);
    expect(await runPromise).toBe(7);
  });

  it("does not poll when the crawler is disabled", async () => {
    const { supervisor, spawnRequests, nextChildren } = harness({ pollEnabled: false });
    const runPromise = supervisor.run();
    nextChildren[0]!.emitExit(0, null);
    expect(await runPromise).toBe(1);
    expect(spawnRequests).toHaveLength(1);
    expect(spawnRequests[0]!.args).toEqual(["dev"]);
  });
});
