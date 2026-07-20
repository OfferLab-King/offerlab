import postgres from "postgres";

import { createInvitation } from "../src/modules/identity-access/infrastructure/invitations";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();

const email = process.argv[2];
const durationDays = Number(process.argv[3] ?? "7");
if (!email || !Number.isFinite(durationDays) || durationDays <= 0) {
  throw new Error("Usage: pnpm invite:create -- email@example.com [expiry-days]");
}
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL is required.");

const database = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const invitation = await createInvitation(database, {
    email,
    expiresAt: new Date(Date.now() + durationDays * 86_400_000),
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  process.stdout.write(`${appUrl}/register#invitation=${encodeURIComponent(invitation.token)}\n`);
  process.stderr.write("Invitation created. This link is displayed once and is not stored.\n");
} finally {
  await database.end();
}
