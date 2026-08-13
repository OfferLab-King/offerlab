import type { ChildProcess, SpawnOptions } from "node:child_process";

import { CrawlPoller } from "./poller";
import { dueWorkerCommand, nextDevCommand } from "./worker-command";

export type NextDevExit = Readonly<{ code: number | null; signal: NodeJS.Signals | null }>;

export type SupervisorOptions = Readonly<{
  spawnProcess: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  terminateProcess: (pid: number, signal: NodeJS.Signals) => void;
  onLog: (message: string) => void;
  onPollError: (error: unknown) => void;
  pollIntervalMs: number;
  batchLimit: number;
  pollEnabled: boolean;
  childExitTimeoutMs: number;
}>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Supervises a Next.js development process and a local crawler poller that
 * invokes the existing due-source worker. Children run in their own process
 * groups so termination reaches the whole spawned command tree.
 */
export class DevWithJobsSupervisor {
  private readonly children = new Set<ChildProcess>();
  private poller: CrawlPoller | null = null;
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(private readonly options: SupervisorOptions) {}

  /**
   * Runs until Next.js exits. Returns zero when the exit was part of a
   * forwarded shutdown and a non-zero code when Next.js exited unexpectedly.
   */
  async run(): Promise<number> {
    const nextDevExit = this.startNextDev();
    this.startPolling();
    const { code } = await nextDevExit;
    if (this.shuttingDown) {
      await this.waitForShutdown();
      return 0;
    }
    this.options.onLog(`next dev exited unexpectedly (code ${code ?? "unknown"})`);
    await this.shutdown("SIGTERM");
    return code === 0 ? 1 : (code ?? 1);
  }

  startNextDev(): Promise<NextDevExit> {
    return new Promise((resolve) => {
      const { command, args } = nextDevCommand();
      const child = this.spawnChild(command, args);
      let settled = false;
      child.once("exit", (code, signal) => {
        if (settled) return;
        settled = true;
        resolve({ code, signal });
      });
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        this.options.onLog(`next dev failed to start: ${errorMessage(error)}`);
        resolve({ code: 1, signal: null });
      });
    });
  }

  startPolling(): void {
    if (!this.options.pollEnabled) {
      this.options.onLog("crawler polling disabled (JOB_CATALOG_ENABLED is not true)");
      return;
    }
    this.poller = new CrawlPoller({
      intervalMs: this.options.pollIntervalMs,
      worker: () => this.runWorkerPoll(),
      onError: (error) => this.options.onPollError(error),
    });
    void this.poller.start();
  }

  shutdown(signal: NodeJS.Signals): Promise<void> {
    this.shutdownPromise ??= this.performShutdown(signal);
    return this.shutdownPromise;
  }

  terminateAll(signal: NodeJS.Signals): void {
    this.signalChildren(signal);
  }

  private waitForShutdown(): Promise<void> {
    return this.shutdownPromise ?? Promise.resolve();
  }

  private async performShutdown(signal: NodeJS.Signals): Promise<void> {
    this.shuttingDown = true;
    this.options.onLog(`shutdown requested (${signal})`);
    this.signalChildren("SIGTERM");
    await this.poller?.stop();
    await this.waitForChildrenToExit();
    this.signalChildren("SIGKILL");
  }

  private async waitForChildrenToExit(): Promise<void> {
    const deadline = Date.now() + this.options.childExitTimeoutMs;
    while (this.children.size > 0 && Date.now() < deadline) {
      await sleep(25);
    }
  }

  private signalChildren(signal: NodeJS.Signals): void {
    for (const child of this.children) {
      if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) continue;
      try {
        this.options.terminateProcess(-child.pid, signal);
      } catch {
        // process group already gone
      }
    }
  }

  private runWorkerPoll(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const { command, args } = dueWorkerCommand(this.options.batchLimit);
      const child = this.spawnChild(command, args);
      let settled = false;
      child.once("exit", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) resolve();
        else reject(new Error(`due worker exited with code ${code ?? "unknown"}`));
      });
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
    });
  }

  private spawnChild(command: string, args: readonly string[]): ChildProcess {
    const child = this.options.spawnProcess(command, [...args], {
      detached: true,
      env: process.env,
      stdio: "inherit",
    });
    this.children.add(child);
    const untrack = (): void => {
      this.children.delete(child);
    };
    child.once("exit", untrack);
    child.once("error", untrack);
    return child;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
