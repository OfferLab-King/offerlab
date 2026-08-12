import type { SourceStatus } from "./source";

export type SourceRunStatus = "running" | "succeeded" | "failed" | "skipped";

export type LatestSourceRun = Readonly<{
  status: SourceRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  jobsDeactivated: number;
  jobsDiscovered: number;
  jobsNew: number;
  jobsUnchanged: number;
  jobsUpdated: number;
  errorSummary: string | null;
}>;

export type LatestSourceRunResult = Readonly<{
  kind: "succeeded" | "failed";
  finishedAt: Date;
  jobsDeactivated: number;
  jobsDiscovered: number;
  jobsNew: number;
  jobsUnchanged: number;
  jobsUpdated: number;
  errorCode: string | null;
}>;

export type SourceOperationalState =
  | Readonly<{ kind: "archived" }>
  | Readonly<{ kind: "paused" }>
  | Readonly<{ kind: "running"; startedAt: Date }>
  | Readonly<{ kind: "queued"; requestedAt: Date }>
  | Readonly<{ kind: "ready"; latest: LatestSourceRunResult | null }>;

export function deriveSourceOperationalState(
  input: Readonly<{
    status: SourceStatus;
    runRequestedAt: Date | null;
    latestRun: LatestSourceRun | null;
  }>,
): SourceOperationalState {
  if (input.status === "archived") return { kind: "archived" };
  if (input.status === "paused") return { kind: "paused" };
  if (input.latestRun?.status === "running") {
    return { kind: "running", startedAt: input.latestRun.startedAt };
  }
  if (input.runRequestedAt) return { kind: "queued", requestedAt: input.runRequestedAt };
  return { kind: "ready", latest: latestResult(input.latestRun) };
}

export function canRequestRun(state: SourceOperationalState): boolean {
  return state.kind === "ready";
}

function latestResult(run: LatestSourceRun | null): LatestSourceRunResult | null {
  if (!run) return null;
  if (run.status !== "succeeded" && run.status !== "failed") return null;
  if (!run.finishedAt) return null;
  return {
    kind: run.status,
    finishedAt: run.finishedAt,
    jobsDeactivated: run.jobsDeactivated,
    jobsDiscovered: run.jobsDiscovered,
    jobsNew: run.jobsNew,
    jobsUnchanged: run.jobsUnchanged,
    jobsUpdated: run.jobsUpdated,
    errorCode: run.errorSummary,
  };
}
