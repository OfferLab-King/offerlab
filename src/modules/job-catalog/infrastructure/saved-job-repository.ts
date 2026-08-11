import type { TransactionSql } from "postgres";

export async function listSavedJobIds(
  database: TransactionSql,
  ownerUserId: string,
): Promise<string[]> {
  const rows = await database<{ job_id: string }[]>`
    select job_id
    from app.user_saved_job
    where owner_user_id = ${ownerUserId}::uuid
    order by created_at desc
  `;
  return rows.map((row) => row.job_id);
}

export async function isJobSaved(
  database: TransactionSql,
  ownerUserId: string,
  jobId: string,
): Promise<boolean> {
  const rows = await database<{ job_id: string }[]>`
    select job_id
    from app.user_saved_job
    where owner_user_id = ${ownerUserId}::uuid and job_id = ${jobId}::uuid
  `;
  return rows.length > 0;
}

export async function saveJob(
  database: TransactionSql,
  ownerUserId: string,
  jobId: string,
): Promise<void> {
  await database`
    insert into app.user_saved_job (owner_user_id, job_id)
    values (${ownerUserId}::uuid, ${jobId}::uuid)
    on conflict (owner_user_id, job_id) do nothing
  `;
}

export async function unsaveJob(
  database: TransactionSql,
  ownerUserId: string,
  jobId: string,
): Promise<void> {
  await database`
    delete from app.user_saved_job
    where owner_user_id = ${ownerUserId}::uuid and job_id = ${jobId}::uuid
  `;
}
