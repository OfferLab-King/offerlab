import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  openLocalBypassDatabaseSession,
  type LocalBypassDatabaseSession,
} from "./local-bypass-database";
import {
  LocalBypassShutdownRequested,
  signalExitCode,
  waitForLocalBypassChildClose,
  watchLocalBypassShutdown,
} from "./local-bypass-signals";

const databaseUrl = process.env.LOCAL_BYPASS_GUARDIAN_DATABASE_URL;
const lockKey = process.env.LOCAL_BYPASS_GUARDIAN_LOCK_KEY;
const port = process.env.LOCAL_BYPASS_GUARDIAN_PORT;
const nextServerScript = fileURLToPath(new URL("./local-bypass-next-server.ts", import.meta.url));

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessGroupClose(processGroupId: number): Promise<void> {
  if (!processGroupExists(processGroupId)) return;
  try {
    process.kill(-processGroupId, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  const termDeadline = Date.now() + 5_000;
  while (processGroupExists(processGroupId) && Date.now() < termDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!processGroupExists(processGroupId)) return;
  process.kill(-processGroupId, "SIGKILL");
  const killDeadline = Date.now() + 5_000;
  while (processGroupExists(processGroupId) && Date.now() < killDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (processGroupExists(processGroupId)) {
    throw new Error("The local bypass Next.js process group did not close after SIGKILL.");
  }
}

function requiredValue(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(`The local bypass child supervisor requires ${name}.`);
}

async function superviseNextDevelopmentServer(): Promise<number> {
  const selectedDatabaseUrl = requiredValue(databaseUrl, "its database URL");
  const selectedLockKey = requiredValue(lockKey, "its advisory-lock key");
  const selectedPort = requiredValue(port, "its port");
  let parentDisconnected = !process.connected;
  let databaseSessionFailure: Error | undefined;
  const databaseSessionController = new AbortController();
  const shutdown = watchLocalBypassShutdown();
  const stopAfterParentDisconnect = (): void => {
    parentDisconnected = true;
    shutdown.stopChild("SIGTERM");
  };
  process.once("disconnect", stopAfterParentDisconnect);
  let databaseSession: LocalBypassDatabaseSession | null | undefined;
  let supervisorFailure: unknown;
  let exitCode = 1;
  try {
    databaseSession = await openLocalBypassDatabaseSession(
      selectedDatabaseUrl,
      selectedLockKey,
      () => {
        databaseSessionFailure ??= new Error(
          "The local bypass child-lifetime database session was lost; stopping Next.js.",
        );
        databaseSessionController.abort(databaseSessionFailure);
        shutdown.stopChild("SIGTERM");
      },
    );
    if (!databaseSession) {
      throw new Error("Another local bypass child supervisor still owns the launcher lock.");
    }
    shutdown.throwIfRequested();
    if (parentDisconnected) {
      throw new Error("The local bypass launcher exited before Next.js could start.");
    }
    const childEnvironment = { ...process.env };
    delete childEnvironment.LOCAL_BYPASS_GUARDIAN_DATABASE_URL;
    delete childEnvironment.LOCAL_BYPASS_GUARDIAN_LOCK_KEY;
    delete childEnvironment.LOCAL_BYPASS_GUARDIAN_PORT;
    childEnvironment.LOCAL_BYPASS_NEXT_PORT = selectedPort;
    const child = spawn("pnpm", ["exec", "tsx", nextServerScript], {
      detached: true,
      env: childEnvironment,
      stdio: "inherit",
    });
    const childClosePromise = waitForLocalBypassChildClose(child);
    shutdown.attachChild(child);
    if (parentDisconnected) shutdown.stopChild("SIGTERM");
    const stopChildAfterDatabaseSessionLoss = (): void => shutdown.stopChild("SIGTERM");
    databaseSessionController.signal.addEventListener("abort", stopChildAfterDatabaseSessionLoss, {
      once: true,
    });
    if (databaseSessionController.signal.aborted) stopChildAfterDatabaseSessionLoss();
    let childClose: Awaited<ReturnType<typeof waitForLocalBypassChildClose>>;
    try {
      childClose = await childClosePromise;
      if (child.pid !== undefined) await waitForProcessGroupClose(child.pid);
    } finally {
      databaseSessionController.signal.removeEventListener(
        "abort",
        stopChildAfterDatabaseSessionLoss,
      );
      shutdown.detachChild(child);
    }
    childClose.errors.forEach((error) => {
      process.stderr.write(`Next.js development server process error: ${error.message}\n`);
    });
    if (databaseSessionFailure) throw databaseSessionFailure;
    if (parentDisconnected) return 0;
    if (shutdown.requestedSignal) return signalExitCode(shutdown.requestedSignal);
    if (childClose.errors.length > 0) {
      throw new AggregateError(
        childClose.errors,
        "Next.js development server reported process errors before closing.",
      );
    }
    if (childClose.signal) return signalExitCode(childClose.signal);
    if (childClose.code === null) {
      throw new Error("Next.js development server exited without an exit code or signal.");
    }
    exitCode = childClose.code;
  } catch (error) {
    if (error instanceof LocalBypassShutdownRequested) {
      exitCode = signalExitCode(error.signal);
    } else {
      supervisorFailure = error;
    }
  } finally {
    let connectionCloseFailure: unknown;
    try {
      await databaseSession?.close();
    } catch (error) {
      connectionCloseFailure = error;
    } finally {
      process.off("disconnect", stopAfterParentDisconnect);
      if (process.connected) process.disconnect();
      shutdown.close();
    }
    const failures = [
      ...new Set(
        [supervisorFailure, databaseSessionFailure, connectionCloseFailure].filter(
          (failure): failure is NonNullable<typeof failure> => failure !== undefined,
        ),
      ),
    ];
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        "The local bypass child supervisor failed and cleanup was incomplete.",
      );
    }
  }
  return exitCode;
}

try {
  process.exitCode = await superviseNextDevelopmentServer();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
}
