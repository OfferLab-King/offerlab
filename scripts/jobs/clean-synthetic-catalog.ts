import postgres, { type TransactionSql } from "postgres";

import {
  preservedSyntheticCompanies,
  syntheticCatalogTargets,
} from "../../src/modules/job-catalog/application/synthetic-catalog-fixtures";
import {
  assertCatalogueDeleteScope,
  buildCleanupPlan,
  catalogueDeleteOrder,
  isLoopbackDatabaseUrl,
  parseCleanupOptions,
  type CleanupPlan,
  type CompanyInventoryRow,
} from "../../src/modules/job-catalog/application/synthetic-catalog-cleanup";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

const options = parseCleanupOptions(process.argv);
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("Refusing to clean: DATABASE_MIGRATION_URL is required.");
if (!isLoopbackDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to clean: DATABASE_MIGRATION_URL must use a loopback host (127.0.0.1, localhost or ::1).",
  );
}

const database = postgres(databaseUrl, { max: 1, prepare: false });

type UserState = Readonly<{
  appUsers: number;
  authUsers: number;
  administrators: ReadonlyArray<Readonly<{ id: string; email: string; role: string }>>;
}>;

type CatalogueCounts = Readonly<{
  companies: number;
  ingestionRuns: number;
  jobs: number;
  savedJobs: number;
  sourceEvents: number;
  sources: number;
}>;

async function inventoryCompanies(database: TransactionSql): Promise<CompanyInventoryRow[]> {
  return database<CompanyInventoryRow[]>`
    select c.id, c.name, c.slug, c.directory_visible as "directoryVisible",
      c.careers_url as "careersUrl",
      (select count(*)::int from app.job_source s where s.company_id = c.id) as sources,
      (select count(*)::int from app.job j where j.company_id = c.id) as jobs,
      (select count(*)::int from app.job_ingestion_run r where r.company_id = c.id) as runs,
      (select count(*)::int from app.job_source_event e where e.company_id = c.id) as events,
      (select count(*)::int from app.user_saved_job u
        join app.job j2 on j2.id = u.job_id where j2.company_id = c.id) as "savedJobs"
    from app.company c
    order by c.name, c.slug
  `;
}

async function catalogueCounts(database: TransactionSql): Promise<CatalogueCounts> {
  const rows = await database<{ table: string; count: number }[]>`
    select 'company' as "table", count(*)::int as count from app.company
    union all select 'source', count(*)::int from app.job_source
    union all select 'job', count(*)::int from app.job
    union all select 'run', count(*)::int from app.job_ingestion_run
    union all select 'event', count(*)::int from app.job_source_event
    union all select 'saved', count(*)::int from app.user_saved_job
  `;
  return {
    companies: rows.find((row) => row.table === "company")!.count,
    ingestionRuns: rows.find((row) => row.table === "run")!.count,
    jobs: rows.find((row) => row.table === "job")!.count,
    savedJobs: rows.find((row) => row.table === "saved")!.count,
    sourceEvents: rows.find((row) => row.table === "event")!.count,
    sources: rows.find((row) => row.table === "source")!.count,
  };
}

async function readUserState(database: TransactionSql): Promise<UserState> {
  const [authUsers, appUsers, administrators] = await Promise.all([
    database<{ count: number }[]>`select count(*)::int as count from auth.users`,
    database<{ count: number }[]>`select count(*)::int as count from app."user"`,
    database<{ id: string; email: string; role: string }[]>`
      select u.id, u.email, u.role from app."user" u where u.role = 'administrator' order by u.email
    `,
  ]);
  return {
    administrators,
    appUsers: appUsers[0]!.count,
    authUsers: authUsers[0]!.count,
  };
}

function printInventory(rows: readonly CompanyInventoryRow[]): void {
  for (const row of rows) {
    process.stdout.write(
      `company id=${row.id} name=${row.name} slug=${row.slug} visible=${row.directoryVisible} sources=${row.sources} jobs=${row.jobs} runs=${row.runs} events=${row.events} saved=${row.savedJobs}\n`,
    );
  }
}

function printPlan(plan: CleanupPlan): void {
  const lines = [
    `\n== Cleanup plan ==`,
    `targets in allow-list: ${syntheticCatalogTargets.length}`,
    `matched for deletion: ${plan.matched.length}`,
    `missing (already clean): ${plan.missing.length}`,
    `identity mismatches: ${plan.mismatched.length}`,
    `blocked by member saves: ${plan.blockedBySavedJobs.length}`,
    `preserved: ${plan.preserved.length}`,
    `unexpected companies: ${plan.unexpected.length}`,
  ];
  for (const row of plan.blockedBySavedJobs) {
    lines.push(`BLOCKED ${row.name} (${row.slug}) has ${row.savedJobs} saved job(s)`);
  }
  for (const mismatch of plan.mismatched) {
    lines.push(
      `MISMATCH id expects ${mismatch.expectedName}/${mismatch.expectedSlug} but found ${mismatch.actualName}/${mismatch.actualSlug}`,
    );
  }
  for (const row of plan.preserved) {
    lines.push(`PRESERVED ${row.name} (${row.slug}) jobs=${row.jobs} saved=${row.savedJobs}`);
  }
  for (const row of plan.unexpected) {
    lines.push(`UNEXPECTED ${row.name} (${row.slug}) is outside the allow-list`);
  }
  for (const target of plan.missing) {
    lines.push(`ALREADY-CLEAN ${target.expectedName} (${target.expectedSlug})`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

const deletedCounts: Record<string, number> = {};

async function deleteSyntheticCompanies(
  database: TransactionSql,
  companyIds: readonly string[],
): Promise<void> {
  assertCatalogueDeleteScope(catalogueDeleteOrder);
  const ids = [...companyIds];
  deletedCounts["app.job_ingestion_run"] = (
    await database`
      delete from app.job_ingestion_run where company_id = any(${ids}::uuid[]) returning id
    `
  ).length;
  deletedCounts["app.job_source_event"] = (
    await database`
      delete from app.job_source_event where company_id = any(${ids}::uuid[]) returning id
    `
  ).length;
  deletedCounts["app.job"] = (
    await database`
      delete from app.job where company_id = any(${ids}::uuid[]) returning id
    `
  ).length;
  deletedCounts["app.job_source"] = (
    await database`
      delete from app.job_source where company_id = any(${ids}::uuid[]) returning id
    `
  ).length;
  deletedCounts["app.company"] = (
    await database`
      delete from app.company where id = any(${ids}::uuid[]) returning id
    `
  ).length;
}

async function main(database: TransactionSql): Promise<number> {
  const rows = await inventoryCompanies(database);
  const before = await catalogueCounts(database);
  const usersBefore = await readUserState(database);

  process.stdout.write(
    `\n== Pre-cleanup inventory ==\nusers(auth)=${usersBefore.authUsers} app_users=${usersBefore.appUsers}\n`,
  );
  for (const admin of usersBefore.administrators) {
    process.stdout.write(`administrator id=${admin.id} email=${admin.email} role=${admin.role}\n`);
  }
  process.stdout.write(
    `catalogue companies=${before.companies} sources=${before.sources} jobs=${before.jobs} runs=${before.ingestionRuns} events=${before.sourceEvents} saved_jobs=${before.savedJobs}\n`,
  );
  process.stdout.write("\n== All catalogue companies ==\n");
  printInventory(rows);

  const plan = buildCleanupPlan(syntheticCatalogTargets, preservedSyntheticCompanies, rows);
  printPlan(plan);

  if (plan.matched.length === 0) {
    process.stdout.write("\nNothing left to delete; catalogue is clean.\n");
    return 0;
  }

  const refused =
    plan.blockedBySavedJobs.length > 0 || plan.mismatched.length > 0 || plan.unexpected.length > 0;
  if (refused) {
    process.stdout.write(
      "\nREFUSING to delete: the plan is not cleanly executable. Review the BLOCKED, MISMATCH and UNEXPECTED rows above.\n",
    );
    return 1;
  }

  if (!options.apply) {
    process.stdout.write(
      `\nDry run only - no writes. Target companies: ${plan.matched.length}, target jobs: ${plan.matched.reduce((sum, row) => sum + row.jobs, 0)}.\nRe-run with --confirm-local --apply to delete.\n`,
    );
    return 0;
  }

  const targetJobs = plan.matched.reduce((sum, row) => sum + row.jobs, 0);
  process.stdout.write(
    `\n== Applying cleanup ==\ntarget companies: ${plan.matched.length}, target jobs: ${targetJobs}\n`,
  );

  await deleteSyntheticCompanies(
    database,
    plan.matched.map((row) => row.id),
  );

  const after = await catalogueCounts(database);
  const usersAfter = await readUserState(database);
  process.stdout.write(
    `\n== Deleted counts ==\ncompanies=${deletedCounts["app.company"]} sources=${deletedCounts["app.job_source"]} jobs=${deletedCounts["app.job"]} runs=${deletedCounts["app.job_ingestion_run"]} events=${deletedCounts["app.job_source_event"]}\n`,
  );
  process.stdout.write(
    `\n== Post-cleanup catalogue ==\ncompanies=${after.companies} sources=${after.sources} jobs=${after.jobs} runs=${after.ingestionRuns} events=${after.sourceEvents} saved_jobs=${after.savedJobs}\n`,
  );
  process.stdout.write(
    `\n== Preserved users ==\nusers(auth)=${usersAfter.authUsers} app_users=${usersAfter.appUsers}\n`,
  );
  for (const admin of usersAfter.administrators) {
    process.stdout.write(`administrator id=${admin.id} email=${admin.email} role=${admin.role}\n`);
  }
  return 0;
}

try {
  process.exitCode = await database.begin((transaction) => main(transaction));
} finally {
  await database.end();
}
