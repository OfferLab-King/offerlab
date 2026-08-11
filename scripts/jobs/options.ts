import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

function readFlag(name: string): string | undefined {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  return argument?.split("=").slice(1).join("=");
}

export function readCliOptions() {
  const rawLimit = Number(readFlag("limit") ?? "25");
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 500) {
    throw new Error("--limit must be an integer between 1 and 500");
  }
  return {
    company: readFlag("company"),
    dryRun: process.argv.includes("--dry-run"),
    limit: rawLimit,
  };
}
