import "server-only";

import postgres, { type Sql, type TransactionSql } from "postgres";

function required(name: "DATABASE_URL" | "IDENTITY_SYNC_DATABASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for this server operation.`);
  return value;
}

let applicationDatabase: Sql | undefined;
let identitySyncDatabase: Sql | undefined;

export function getApplicationDatabase(): Sql {
  applicationDatabase ??= postgres(required("DATABASE_URL"), { max: 5, prepare: false });
  return applicationDatabase;
}

export function getIdentitySyncDatabase(): Sql {
  identitySyncDatabase ??= postgres(required("IDENTITY_SYNC_DATABASE_URL"), {
    max: 2,
    prepare: false,
  });
  return identitySyncDatabase;
}

export async function withApplicationUser<T>(
  userId: string,
  operation: (transaction: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await getApplicationDatabase().begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return await operation(transaction);
  })) as T;
}
