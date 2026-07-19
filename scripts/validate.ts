import { spawnSync } from "node:child_process";

const steps = [
  "env:example:check",
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "db:start",
  "db:validate",
  "test:integration",
  "build",
] as const;

for (const step of steps) {
  process.stdout.write(`\n==> pnpm ${step}\n`);
  const result = spawnSync("pnpm", [step], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("\nAll canonical validation checks passed.\n");
