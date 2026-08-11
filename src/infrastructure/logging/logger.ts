import "server-only";

import pino, { type DestinationStream, type Logger } from "pino";

import { redactedPaths } from "./redaction";

export function createLogger(
  options?: Readonly<{ destination?: DestinationStream; level?: string }>,
): Logger {
  return pino(
    {
      base: null,
      level: options?.level ?? "info",
      redact: {
        censor: "[REDACTED]",
        paths: redactedPaths,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    options?.destination,
  );
}

export const logger = createLogger(
  process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : undefined,
);
