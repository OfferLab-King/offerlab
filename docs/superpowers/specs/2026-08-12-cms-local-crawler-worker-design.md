# CMS-triggered local crawler worker

## Goal

Make the administrator **Run now** control execute a source crawl during local
development without requiring a second manually entered command, while retaining
the existing queued-worker architecture in production.

## Architecture

The web application remains responsible only for authorization and durable work
requests. Clicking **Run now** records `job_source.run_requested_at` and the
requesting administrator. It never performs employer-network requests inside the
Next.js server action.

A local polling process runs beside Next.js. It invokes the same due-source worker
used in production, so manual requests, source locks, crawl limits, UK admission,
failure handling and observability have one implementation. Production continues
to use the versioned systemd timer.

## Developer command

Add `pnpm dev:jobs` as the normal command for crawler development. It starts:

1. Next.js on the configured local port; and
2. a bounded local worker loop that polls for due or manually requested sources.

The process supervisor must forward termination signals and stop both children if
either exits unexpectedly. It must not reset, seed or mutate the database beyond
normal application and crawler operations.

The ordinary `pnpm dev` command remains available when no worker is wanted.

## CMS behaviour

Each source displays an operational state derived from durable records:

- **Run now** when active and no request is pending;
- **Queued** after a manual request is accepted;
- **Running** when its latest ingestion run is active;
- the latest outcome and counts after completion; or
- **Paused** / **Archived**, with no runnable action.

The action must remain idempotent while queued. Repeated clicks must not create
parallel work. The page should explain that local execution requires `pnpm
dev:jobs`; in production the configured worker handles the same queue.

## Polling and concurrency

Local polling defaults to five seconds and executes a small bounded batch. The
existing database advisory locks and source locks remain authoritative, so a local
worker and a manually invoked CLI cannot process the same source concurrently.
Polling must not run when `JOB_CATALOG_ENABLED=false`.

## Failure handling

Worker failures are recorded through the existing ingestion-run and source-event
paths. A failed poll must not terminate Next.js; the loop reports the error and
continues after its interval. Repeated source failures retain the existing
automatic-pause policy.

No account, source, job or crawl history is deleted by this workflow. In
particular, `dev:jobs` must never call `db:reset`, integration tests or seed
commands.

## Testing

Tests must prove:

- a CMS request becomes due work and records the administrator;
- duplicate requests remain one durable request;
- the local polling runner uses the existing due-crawl command and survives an
  individual failed poll;
- shutdown terminates both local processes;
- paused and archived sources cannot be requested;
- the CMS renders queued/running/latest-result states; and
- no reset or seed command is invoked.

Type checking, unit tests, integration tests and a production build must pass.
