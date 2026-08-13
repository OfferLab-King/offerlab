import type { ChildProcess } from "node:child_process";
import { constants } from "node:os";

export type LocalBypassSignalSource = Pick<NodeJS.Process, "off" | "on">;

export class LocalBypassShutdownRequested extends Error {
  constructor(readonly signal: NodeJS.Signals) {
    super(`Local bypass shutdown requested by ${signal}.`);
    this.name = "LocalBypassShutdownRequested";
  }
}

export function signalExitCode(signal: NodeJS.Signals): number {
  return 128 + (constants.signals[signal] ?? 1);
}

export function watchLocalBypassShutdown(signalSource: LocalBypassSignalSource = process) {
  let child: ChildProcess | undefined;
  let closed = false;
  let requestedSignal: NodeJS.Signals | null = null;

  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (child?.pid === undefined) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  };
  const requestShutdown = (signal: NodeJS.Signals): void => {
    if (requestedSignal) return;
    requestedSignal = signal;
    forwardSignal(signal);
  };
  const handleSigint = (): void => requestShutdown("SIGINT");
  const handleSigterm = (): void => requestShutdown("SIGTERM");
  signalSource.on("SIGINT", handleSigint);
  signalSource.on("SIGTERM", handleSigterm);

  return {
    get requestedSignal(): NodeJS.Signals | null {
      return requestedSignal;
    },
    attachChild(nextChild: ChildProcess): void {
      child = nextChild;
      if (requestedSignal) forwardSignal(requestedSignal);
    },
    close(): void {
      if (closed) return;
      closed = true;
      signalSource.off("SIGINT", handleSigint);
      signalSource.off("SIGTERM", handleSigterm);
    },
    detachChild(previousChild: ChildProcess): void {
      if (child === previousChild) child = undefined;
    },
    throwIfRequested(): void {
      if (requestedSignal) throw new LocalBypassShutdownRequested(requestedSignal);
    },
  };
}

export type LocalBypassShutdownWatcher = ReturnType<typeof watchLocalBypassShutdown>;
