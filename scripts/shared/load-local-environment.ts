import { existsSync } from "node:fs";

export function loadLocalEnvironment(): void {
  for (const environmentFile of [".env.local", ".env"]) {
    if (existsSync(environmentFile)) {
      process.loadEnvFile(environmentFile);
      return;
    }
  }
}
