import postgres from "postgres";
import { seedInitialCohort } from "../../src/modules/job-catalog/application/seed-companies";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

const confirmed = process.argv.includes("--confirm-local");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!confirmed)
  throw new Error("Refusing to seed: pass --confirm-local for the deterministic example cohort.");
if (!databaseUrl) throw new Error("Refusing to seed: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl))
  throw new Error(
    "Refusing to seed: DATABASE_MIGRATION_URL must use an approved local database host.",
  );

const database = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const created = await database.begin((transaction) => seedInitialCohort(transaction));
  for (const company of created) {
    process.stdout.write(`Seeded ${company.name} (${company.slug}).\n`);
  }
} finally {
  await database.end();
}
