import type { Sql, TransactionSql } from "postgres";

export async function withIdentitySyncRole<T>(
  database: Sql,
  operation: (transaction: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await database.begin(async (transaction) => {
    await transaction`set local role offerlab_identity_sync`;
    return await operation(transaction);
  })) as T;
}
