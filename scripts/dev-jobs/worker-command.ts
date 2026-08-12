export type SpawnRequest = Readonly<{ command: string; args: readonly string[] }>;

export const DEFAULT_WORKER_BATCH_LIMIT = 3;
const MINIMUM_BATCH_LIMIT = 1;
const MAXIMUM_BATCH_LIMIT = 25;

export function nextDevCommand(): SpawnRequest {
  return { command: "pnpm", args: ["dev"] };
}

export function dueWorkerCommand(batchLimit: number): SpawnRequest {
  return { command: "pnpm", args: ["jobs:crawl:due", `--limit=${batchLimit}`] };
}

export function readBatchLimit(environment: Readonly<Record<string, string | undefined>>): number {
  const raw = Number(environment.JOB_LOCAL_WORKER_BATCH_LIMIT);
  if (!Number.isInteger(raw) || raw < MINIMUM_BATCH_LIMIT || raw > MAXIMUM_BATCH_LIMIT) {
    return DEFAULT_WORKER_BATCH_LIMIT;
  }
  return raw;
}
