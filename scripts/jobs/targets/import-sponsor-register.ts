import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import postgres, { type TransactionSql } from "postgres";
import * as XLSX from "xlsx";

import {
  parseSponsorRegister,
  sponsorRegisterNameKey,
  uniqueSponsorCompanySlug,
  type SponsorRegisterOrganisation,
} from "../../../src/modules/employer-research/domain/sponsor-register";
import { loadLocalEnvironment } from "../../shared/load-local-environment";

loadLocalEnvironment();

const requestedFilePath = process.argv.find((argument) => argument.startsWith("--file="))?.slice(7);
const requestedSnapshotDate = process.argv
  .find((argument) => argument.startsWith("--snapshot="))
  ?.slice(11);
const apply = process.argv.includes("--confirm-local");
if (!requestedFilePath) throw new Error("--file=/absolute/path/to/register.csv is required");
if (!requestedSnapshotDate || !/^\d{4}-\d{2}-\d{2}$/u.test(requestedSnapshotDate)) {
  throw new Error("--snapshot=YYYY-MM-DD is required");
}
const filePath: string = requestedFilePath;
const snapshotDate: string = requestedSnapshotDate;
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl || !/(?:127\.0\.0\.1|localhost|\[?::1\]?)/u.test(databaseUrl)) {
  throw new Error("Sponsor register import requires a loopback DATABASE_MIGRATION_URL");
}

const fileBytes = await readFile(filePath);
const checksum = createHash("sha256").update(fileBytes).digest("hex");
const workbook = XLSX.read(fileBytes, { raw: false, type: "buffer" });
const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
if (!firstSheet) throw new Error("Sponsor register contains no worksheet");
const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
  defval: "",
  raw: false,
});
const parsed = parseSponsorRegister(rawRows);
if (parsed.rejected.length > 0) {
  throw new Error(`Sponsor register has ${parsed.rejected.length} invalid rows`);
}

const database = postgres(databaseUrl, { max: 1, prepare: false });

type ExistingCompany = Readonly<{ id: string; name: string; slug: string }>;
type ExistingAlias = Readonly<{ alias: string; companyId: string }>;
type ExistingSponsor = Readonly<{
  companyId: string | null;
  legalName: string;
  snapshotDate: string;
}>;

function uniqueIdMap(entries: readonly { key: string; id: string }[]): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const entry of entries) {
    const ids = candidates.get(entry.key) ?? new Set<string>();
    ids.add(entry.id);
    candidates.set(entry.key, ids);
  }
  return new Map(
    [...candidates]
      .filter(([, ids]) => ids.size === 1)
      .map(([key, ids]) => [key, [...ids][0]!] as const),
  );
}

async function readExisting(transaction: TransactionSql) {
  const [companies, aliases, sponsors] = await Promise.all([
    transaction<ExistingCompany[]>`select id, name, slug from app.company`,
    transaction<ExistingAlias[]>`
      select alias, company_id as "companyId" from app.employer_alias
    `,
    transaction<ExistingSponsor[]>`
      select company_id as "companyId", legal_name as "legalName",
        source_snapshot_date::text as "snapshotDate"
      from app.employer_sponsor_entity
      order by source_snapshot_date desc
    `,
  ]);
  return { aliases, companies, sponsors };
}

type PlannedOrganisation = Readonly<{
  companyId: string | null;
  match: "sponsor" | "company" | "alias" | "new";
  organisation: SponsorRegisterOrganisation;
  slug: string | null;
}>;

function buildPlan(
  organisations: readonly SponsorRegisterOrganisation[],
  existing: Awaited<ReturnType<typeof readExisting>>,
): PlannedOrganisation[] {
  const companyByName = uniqueIdMap(
    existing.companies.map((company) => ({
      id: company.id,
      key: sponsorRegisterNameKey(company.name),
    })),
  );
  const companyByAlias = uniqueIdMap(
    existing.aliases.map((alias) => ({
      id: alias.companyId,
      key: sponsorRegisterNameKey(alias.alias),
    })),
  );
  const companyBySponsor = new Map<string, string>();
  for (const sponsor of existing.sponsors) {
    const key = sponsorRegisterNameKey(sponsor.legalName);
    if (sponsor.companyId && !companyBySponsor.has(key))
      companyBySponsor.set(key, sponsor.companyId);
  }
  const slugs = new Set(existing.companies.map((company) => company.slug));

  return organisations.map((organisation) => {
    const key = sponsorRegisterNameKey(organisation.legalName);
    const sponsorId = companyBySponsor.get(key);
    if (sponsorId) return { companyId: sponsorId, match: "sponsor", organisation, slug: null };
    const companyId = companyByName.get(key);
    if (companyId) return { companyId, match: "company", organisation, slug: null };
    const aliasId = companyByAlias.get(key);
    if (aliasId) return { companyId: aliasId, match: "alias", organisation, slug: null };
    return {
      companyId: null,
      match: "new",
      organisation,
      slug: uniqueSponsorCompanySlug(organisation.legalName, slugs),
    };
  });
}

function counts(plan: readonly PlannedOrganisation[]) {
  return Object.fromEntries(
    (["sponsor", "company", "alias", "new"] as const).map((match) => [
      match,
      plan.filter((entry) => entry.match === match).length,
    ]),
  );
}

async function insertBatches(
  transaction: TransactionSql,
  table: string,
  rows: readonly Record<string, unknown>[],
  batchSize = 750,
): Promise<void> {
  for (let index = 0; index < rows.length; index += batchSize) {
    await transaction`insert into ${transaction(table)} ${transaction(rows.slice(index, index + batchSize))}`;
  }
}

async function applyPlan(
  transaction: TransactionSql,
  plan: readonly PlannedOrganisation[],
): Promise<void> {
  const newRows = plan
    .filter((entry) => entry.match === "new")
    .map((entry) => ({
      active: true,
      careers_url: `https://employer.invalid/${entry.slug}`,
      crawl_allowed: "unknown",
      directory_visible: false,
      name: entry.organisation.legalName,
      notes: `Created from the Home Office sponsor register snapshot ${snapshotDate}; no official source configured.`,
      slug: entry.slug,
      source_type: "unknown",
    }));
  await insertBatches(transaction, "app.company", newRows);

  const created = await transaction<{ id: string; slug: string }[]>`
    select id, slug from app.company
    where slug = any(${plan.filter((entry) => entry.slug).map((entry) => entry.slug!)}::text[])
  `;
  const idBySlug = new Map(created.map((row) => [row.slug, row.id]));
  const companyId = (entry: PlannedOrganisation): string =>
    entry.companyId ?? idBySlug.get(entry.slug!)!;

  await transaction`update app.employer_sponsor_entity set active_in_snapshot = false where active_in_snapshot`;

  const currentExisting = await transaction<{ id: string; legalName: string }[]>`
    select id, legal_name as "legalName" from app.employer_sponsor_entity
    where source_snapshot_date = ${snapshotDate}::date
  `;
  const currentNameByKey = new Map<string, string>(
    currentExisting.map((row) => [sponsorRegisterNameKey(row.legalName), row.legalName] as const),
  );
  const sponsorRows = plan.map((entry) => {
    const organisation = entry.organisation;
    const rating = organisation.ratings.join("; ").slice(0, 80) || null;
    const location = organisation.locations[0]?.slice(0, 160) ?? null;
    return {
      active_in_snapshot: true,
      company_id: companyId(entry),
      identity_confidence: "High",
      identity_notes:
        organisation.locations.length > 1
          ? `${organisation.locations.length} register locations aggregated; first shown.`
          : "Exact legal-organisation identity from the register.",
      legal_name:
        currentNameByKey.get(sponsorRegisterNameKey(organisation.legalName)) ??
        organisation.legalName,
      routes: [...organisation.routes],
      source_reference: `Home Office Worker and Temporary Worker sponsor register ${snapshotDate}; ${basename(filePath)}; sha256:${checksum}`,
      source_snapshot_date: snapshotDate,
      sponsor_rating: rating,
      town_city: location,
    };
  });
  for (let index = 0; index < sponsorRows.length; index += 500) {
    const batch = sponsorRows.slice(index, index + 500);
    await transaction`
      insert into app.employer_sponsor_entity ${transaction(batch)}
      on conflict (legal_name, source_snapshot_date) do update set
        company_id = excluded.company_id,
        town_city = excluded.town_city,
        sponsor_rating = excluded.sponsor_rating,
        routes = excluded.routes,
        active_in_snapshot = true,
        identity_confidence = excluded.identity_confidence,
        identity_notes = excluded.identity_notes,
        source_reference = excluded.source_reference,
        updated_at = now()
    `;
  }

  const companyNameById = new Map(
    (await transaction<ExistingCompany[]>`select id, name, slug from app.company`).map((row) => [
      row.id,
      sponsorRegisterNameKey(row.name),
    ]),
  );
  const aliasRows = plan
    .filter(
      (entry) =>
        companyNameById.get(companyId(entry)) !==
        sponsorRegisterNameKey(entry.organisation.legalName),
    )
    .map((entry) => ({
      alias: entry.organisation.legalName,
      alias_type: "sponsor_legal",
      company_id: companyId(entry),
      source: `sponsor-register-${snapshotDate}`,
    }));
  for (let index = 0; index < aliasRows.length; index += 750) {
    await transaction`
      insert into app.employer_alias ${transaction(aliasRows.slice(index, index + 750))}
      on conflict (company_id, alias) do nothing
    `;
  }
}

try {
  await database.begin(async (transaction) => {
    const existing = await readExisting(transaction);
    const plan = buildPlan(parsed.organisations, existing);
    process.stdout.write(
      `${JSON.stringify(
        {
          apply,
          checksum,
          file: basename(filePath),
          matches: counts(plan),
          organisations: parsed.organisations.length,
          rejected: parsed.rejected.length,
          snapshotDate,
          sourceRows: parsed.sourceRows,
        },
        null,
        2,
      )}\n`,
    );
    if (apply) await applyPlan(transaction, plan);
  });
} finally {
  await database.end();
}
