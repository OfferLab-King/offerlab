import type { Sql } from "postgres";

export type AdministratorPromotion = Readonly<{
  email: string;
  userId: string;
}>;

type UserRow = Readonly<{
  email: string;
  email_confirmed_at: Date | null;
  id: string;
  role: string;
}>;

export async function promoteVerifiedUserToAdministrator(
  database: Sql,
  email: string,
): Promise<AdministratorPromotion> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("An email address is required.");
  }

  return database.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('offerlab:administrator-promotion'))`;

    const users = await transaction<UserRow[]>`
      select
        app_user.id,
        auth_user.email,
        app_user.role,
        auth_user.email_confirmed_at
      from app."user" as app_user
      inner join auth.users as auth_user on auth_user.id = app_user.auth_user_id
      where lower(auth_user.email) = ${normalizedEmail}
      for update of app_user
    `;
    const user = users[0];

    if (!user) {
      throw new Error("No OfferLab user exists for that email address.");
    }

    if (!user.email_confirmed_at) {
      throw new Error("The OfferLab user has not verified their email address.");
    }

    if (user.role === "administrator") {
      throw new Error("The OfferLab user is already an administrator.");
    }

    const existingAdministrators = await transaction<{ id: string }[]>`
      select id
      from app."user"
      where role = 'administrator'
        and id <> ${user.id}::uuid
      for update
    `;

    if (existingAdministrators.length > 0) {
      throw new Error(
        "An administrator already exists. Additional administrators require an approved role-management change.",
      );
    }

    await transaction`
      update app."user"
      set role = 'administrator', updated_at = now()
      where id = ${user.id}::uuid
    `;

    await transaction`
      insert into app.audit_event (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'administrator.promoted',
        'user',
        ${user.id}::uuid,
        jsonb_build_object('source', 'one_time_cli')
      )
    `;

    return { email: user.email, userId: user.id };
  });
}
