import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
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
  const companyIds = saved.map((entry) => entry.companyId);
  // Bounded projection: fetch only the saved employers' public facts instead
  // of materialising the whole directory view per request.
  const profiles = await withApplicationRole(
    (database) =>
      database<SavedEmployerView[]>`
      select c.id as "companyId", c.slug, c.name, c.logo_url,
        nullif(c.website_url, '') as website_url,
        nullif(c.careers_url, '') as careers_url,
        c.employer_industry_key,
        coalesce(sp.has_sponsor, false) as has_sponsor,
        (
          select count(*)::int
          from app.job j
          where j.company_id = c.id
            and j.active and j.publication_status = 'published'
            and j.eligibility_status = 'eligible'
            and (j.application_deadline is null or j.application_deadline >= now())
        ) as current_jobs
      from app.company c
      left join app.employer_public_sponsor sp on sp.company_id = c.id
      where c.id = any(${companyIds}::uuid[]) and c.active
    `,
  );
  const byId = new Map(profiles.map((profile) => [profile.companyId, profile]));
  return saved.flatMap((entry) => {
    const profile = byId.get(entry.companyId);
    if (!profile) return [];
    return [{ ...profile, savedAt: entry.savedAt }];
  });
}
