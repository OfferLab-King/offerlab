import postgres from "postgres";

import { promoteVerifiedUserToAdministrator } from "../src/infrastructure/identity/promote-administrator";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();

const argumentsWithoutFlags = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith("--"));
const email = argumentsWithoutFlags[0];
const confirmed = process.argv.includes("--confirm");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;

if (!email || !confirmed) {
  throw new Error("Usage: pnpm admin:promote -- <verified-email> --confirm");
}

if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL is required.");
}

const database = postgres(databaseUrl, {
  max: 1,
  onnotice: () => undefined,
  prepare: false,
});

try {
  const promotion = await promoteVerifiedUserToAdministrator(database, email);
  process.stdout.write(`Promoted ${promotion.email} (${promotion.userId}) to administrator.\n`);
} finally {
  await database.end();
}
