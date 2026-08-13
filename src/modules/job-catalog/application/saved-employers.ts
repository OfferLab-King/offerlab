import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { listEmployerPublicDirectory } from "../infrastructure/catalog-repository";
import { withApplicationRole } from "../../../infrastructure/database/runtime-connections";

export type SavedEmployerView = Readonly<{
  companyId: string;
  slug: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  careers_url: string | null;
  employer_industry_key: string | null;
  current_jobs: number;
  has_sponsor: boolean;
  savedAt: Date;
}>;

/**
 * Owner-scoped saved employers. Never creates notifications or alerts
 * without an explicit member preference.
 */
export async function saveEmployerForMember(ownerId: string, companyId: string): Promise<void> {
  await withApplicationUser(ownerId, (database) => {
    return database`
      insert into app.user_saved_employer (owner_user_id, company_id)
      values (${ownerId}::uuid, ${companyId}::uuid)
      on conflict (owner_user_id, company_id) do nothing
    `;
  });
}

export async function unsaveEmployerForMember(ownerId: string, companyId: string): Promise<void> {
  await withApplicationUser(ownerId, (database) => {
    return database`
      delete from app.user_saved_employer
      where owner_user_id = ${ownerId}::uuid and company_id = ${companyId}::uuid
    `;
  });
}

export async function isEmployerSavedForMember(
  ownerId: string,
  companyId: string,
): Promise<boolean> {
  return withApplicationUser(ownerId, async (database) => {
    const rows = await database<{ id: string }[]>`
      select id from app.user_saved_employer
      where owner_user_id = ${ownerId}::uuid and company_id = ${companyId}::uuid
      limit 1
    `;
    return rows.length === 1;
  });
}

export async function listSavedEmployersForMember(ownerId: string): Promise<SavedEmployerView[]> {
  const saved = await withApplicationUser(
    ownerId,
    (database) =>
      database<{ companyId: string; savedAt: Date }[]>`
      select company_id as "companyId", created_at as "savedAt"
      from app.user_saved_employer
      where owner_user_id = ${ownerId}::uuid
      order by created_at desc
    `,
  );
  if (saved.length === 0) return [];
  const profiles = await withApplicationRole((database) => listEmployerPublicDirectory(database));
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return saved.flatMap((entry) => {
    const profile = byId.get(entry.companyId);
    if (!profile) return [];
    return [
      {
        companyId: profile.id,
        slug: profile.slug,
        name: profile.name,
        logo_url: profile.logo_url,
        website_url: profile.website_url,
        careers_url: profile.careers_url,
        employer_industry_key: profile.employer_industry_key,
        current_jobs: profile.current_jobs,
        has_sponsor: profile.has_sponsor,
        savedAt: entry.savedAt,
      },
    ];
  });
}
