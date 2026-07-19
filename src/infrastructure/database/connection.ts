import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export type OfferLabDatabase = PostgresJsDatabase<typeof schema>;

export type DatabaseConnection = Readonly<{
  client: Sql;
  database: OfferLabDatabase;
  close: () => Promise<void>;
}>;

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, {
    max: 5,
    prepare: false,
  });

  return {
    client,
    close: () => client.end(),
    database: drizzle(client, { schema }),
  };
}
