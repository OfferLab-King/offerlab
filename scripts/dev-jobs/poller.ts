export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const MINIMUM_POLL_INTERVAL_MS = 1_000;

export type CrawlPollerOptions = Readonly<{
  intervalMs: number;
  worker: () => Promise<void>;
  onError?: (error: unknown) => void;
}>;

/**
 * Bounded local crawler poller. Polls are awaited one at a time so a slow
 * crawl can never overlap the next poll, and a failed poll is reported and
 * skipped rather than terminating the loop.
 */
export class CrawlPoller {
  private stopped = false;
  private loopPromise: Promise<void> | null = null;
  private activePoll: Promise<void> | null = null;
  private readonly onError: (error: unknown) => void;

  constructor(private readonly options: CrawlPollerOptions) {
    this.onError = options.onError ?? (() => undefined);
  }

  get hasActivePoll(): boolean {
    return this.activePoll !== null;
  }

  start(): Promise<void> {
    this.loopPromise ??= this.runLoop();
    return this.loopPromise;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.loopPromise;
  }

  private async runLoop(): Promise<void> {
    while (!this.stopped) {
      const poll = this.options.worker();
      this.activePoll = poll;
      try {
        await poll;
      } catch (error) {
        this.onError(error);
      } finally {
        this.activePoll = null;
      }
      if (this.stopped) return;
      await this.sleepInterruptibly(this.options.intervalMs);
    }
  }

  private async sleepInterruptibly(ms: number): Promise<void> {
    const deadline = Date.now() + ms;
    while (!this.stopped && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(50, deadline - Date.now())));
    }
  }
}

export function readPollIntervalMs(
  environment: Readonly<Record<string, string | undefined>>,
): number {
  const raw = Number(environment.JOB_LOCAL_WORKER_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_POLL_INTERVAL_MS;
  return Math.max(MINIMUM_POLL_INTERVAL_MS, Math.round(raw));
}
