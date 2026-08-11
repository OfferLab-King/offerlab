import pino from "pino";
import { redactedPaths } from "../../../infrastructure/logging/redaction";

/**
 * Module-local logger for the job catalog crawler and enrichment workers.
 * These code paths also run as tsx CLI processes where the shared server-side
 * logger (guarded by the server-only marker) cannot be imported. Redaction is
 * configured from the shared privacy list so job source metadata is never
 * written to logs.
 */
export const logger = pino({
  base: null,
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    censor: "[REDACTED]",
    paths: redactedPaths,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
