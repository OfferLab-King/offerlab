import type { ChildProcess } from "node:child_process";
import { constants } from "node:os";

export type LocalBypassSignalSource = Pick<NodeJS.Process, "off" | "on">;
type ChildClose = Readonly<{
  code: number | null;
  errors: readonly Error[];
  signal: NodeJS.Signals | null;
}>;
type ShutdownOptions = Readonly<{
  escalationDelayMs?: number;
  killProcessGroup?: (processGroupId: number, signal: NodeJS.Signals) => void;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class LocalBypassShutdownRequested extends Error {
  constructor(readonly signal: NodeJS.Signals) {
    super(`Local bypass shutdown requested by ${signal}.`);
    this.name = "LocalBypassShutdownRequested";
  }
}

export function signalExitCode(signal: NodeJS.Signals): number {
  return 128 + (constants.signals[signal] ?? 1);
}

export function waitForLocalBypassChildClose(child: ChildProcess): Promise<ChildClose> {
  return new Promise((resolve, reject) => {
    const errors: Error[] = [];
    let spawnFailure: Error | undefined;
    child.on("error", (error) => {
      const recordedError = error instanceof Error ? error : new Error(String(error));
      errors.push(recordedError);
      if (child.pid === undefined) spawnFailure ??= recordedError;
    });
    child.once("close", (code, signal) => {
      if (spawnFailure) {
        reject(
          new Error(`Next.js development server failed to start: ${errorMessage(spawnFailure)}`, {
            cause: spawnFailure,
          }),
        );
        return;
      }
      resolve({ code, errors, signal });
    });
  });
}

export function watchLocalBypassShutdown(
  signalSource: LocalBypassSignalSource = process,
  options: ShutdownOptions = {},
) {
  let child: ChildProcess | undefined;
  let closed = false;
  let requestedSignal: NodeJS.Signals | null = null;
  const forwardingFailures: Error[] = [];
  const escalationTimers: NodeJS.Timeout[] = [];
  const escalationDelayMs = options.escalationDelayMs ?? 5_000;
  const killProcessGroup = options.killProcessGroup ?? process.kill;

  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (child?.pid === undefined) return;
    try {
      killProcessGroup(-child.pid, signal);
      return;
    } catch (groupError) {
      try {
        if (child.kill(signal)) return;
        throw new Error("child.kill returned false");
      } catch (childError) {
        forwardingFailures.push(
          new AggregateError(
            [groupError, childError],
            `Could not forward ${signal} to the Next.js process group.`,
          ),
        );
      }
    }
  };
  const scheduleEscalation = (): void => {
    escalationTimers.push(
      setTimeout(() => forwardSignal("SIGTERM"), escalationDelayMs),
      setTimeout(() => forwardSignal("SIGKILL"), escalationDelayMs * 2),
    );
  };
  const clearEscalation = (): void => {
    escalationTimers.splice(0).forEach((timer) => clearTimeout(timer));
  };
  const requestShutdown = (signal: NodeJS.Signals): void => {
    if (requestedSignal) return;
    requestedSignal = signal;
    forwardSignal(signal);
    if (child) scheduleEscalation();
  };
  const handleSigint = (): void => requestShutdown("SIGINT");
  const handleSigterm = (): void => requestShutdown("SIGTERM");
  signalSource.on("SIGINT", handleSigint);
  signalSource.on("SIGTERM", handleSigterm);

  return {
    get requestedSignal(): NodeJS.Signals | null {
      return requestedSignal;
    },
    get forwardingFailures(): readonly Error[] {
      return forwardingFailures;
    },
    attachChild(nextChild: ChildProcess): void {
      child = nextChild;
      if (requestedSignal) {
        forwardSignal(requestedSignal);
        scheduleEscalation();
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      clearEscalation();
      signalSource.off("SIGINT", handleSigint);
      signalSource.off("SIGTERM", handleSigterm);
    },
    detachChild(previousChild: ChildProcess): void {
      if (child === previousChild) {
        clearEscalation();
        child = undefined;
      }
    },
    stopChild(signal: NodeJS.Signals): void {
      forwardSignal(signal);
      if (child) scheduleEscalation();
    },
    throwIfRequested(): void {
      if (requestedSignal) throw new LocalBypassShutdownRequested(requestedSignal);
    },
  };
}

export type LocalBypassShutdownWatcher = ReturnType<typeof watchLocalBypassShutdown>;
