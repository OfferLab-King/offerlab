import postgres from "postgres";

import { cleanupExpiredAuthRateLimits } from "../src/modules/identity-access/infrastructure/rate-limits";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();

const databaseUrl = process.env.IDENTITY_SYNC_DATABASE_URL;
if (!databaseUrl) throw new Error("IDENTITY_SYNC_DATABASE_URL is required.");

const database = postgres(databaseUrl, { max: 1, prepare: false });
let totalDeleted = 0;
try {
  for (let batch = 0; batch < 100; batch += 1) {
    const deleted = await cleanupExpiredAuthRateLimits(database);
    totalDeleted += deleted;
    if (deleted < 500) break;
    if (batch === 99) throw new Error("Cleanup stopped after the 100-batch safety limit.");
  }
  process.stdout.write(`Deleted ${totalDeleted} expired authentication rate-limit rows.\n`);
} finally {
  await database.end();
}
