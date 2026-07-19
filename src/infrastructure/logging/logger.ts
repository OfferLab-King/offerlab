import "server-only";

import pino, { type DestinationStream, type Logger } from "pino";

const redactedPaths = [
  "authorization",
  "cookie",
  "email",
  "applicationNotes",
  "notes",
  "onboardingAnswers",
  "password",
  "req.headers.authorization",
  "req.headers.cookie",
  "token",
  "*.applicationNotes",
  "*.notes",
  "*.onboardingAnswers",
];

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
