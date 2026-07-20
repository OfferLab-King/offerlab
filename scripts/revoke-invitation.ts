import postgres from "postgres";

import { revokeInvitation } from "../src/modules/identity-access/infrastructure/invitations";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();

const invitationId = process.argv[2];
if (!invitationId) throw new Error("Usage: pnpm invite:revoke -- invitation-uuid");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL is required.");

const database = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await revokeInvitation(database, invitationId);
  process.stdout.write("Invitation revoked.\n");
} finally {
  await database.end();
}
