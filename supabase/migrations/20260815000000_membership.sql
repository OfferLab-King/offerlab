begin;

-- Membership entitlements: the paid OfferLab membership tier.
--
-- A row exists only for members with a paid plan; its absence means the
-- member is on the free tier. The record is member-owned: the member can read
-- and (in self-serve test mode) update their own row, and nothing else. Paid
-- activation in production is performed by the privileged membership CLI
-- (migration role), mirroring the administrator-promotion pattern; payment
-- provider wiring stays a recorded open decision.

create table app.membership (
  user_id uuid primary key references app."user" (id) on delete cascade,
  plan text not null default 'membership'
    check (plan in ('membership')),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired')),
  period_start timestamptz not null default now(),
  period_end timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'stripe', 'test')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.membership is
  'Paid OfferLab membership entitlements; member-owned, forced RLS, one row per paying member.';
comment on column app.membership.source is
  'How the membership was activated: manual (founder), test (local self-serve) or stripe (once the provider decision is recorded).';

alter table app.membership enable row level security;

create policy membership_owner_select
  on app.membership
  for select
  to offerlab_app
  using (user_id = app.current_user_id());

create policy membership_owner_insert
  on app.membership
  for insert
  to offerlab_app
  with check (user_id = app.current_user_id());

create policy membership_owner_update
  on app.membership
  for update
  to offerlab_app
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy membership_owner_delete
  on app.membership
  for delete
  to offerlab_app
  using (user_id = app.current_user_id());

revoke all on app.membership from public, anon, authenticated;
revoke all on app.membership from offerlab_identity_sync;
grant select, insert, update, delete on app.membership to offerlab_app;

-- Security-definer administrator view of all memberships. Ordinary
-- administrator screens never show membership payment state outside this
-- purpose-limited read.
create function app.membership_admin_view()
returns table (
  user_id uuid,
  email text,
  plan text,
  status text,
  period_start timestamptz,
  period_end timestamptz,
  source text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select m.user_id, u.email, m.plan, m.status, m.period_start, m.period_end, m.source, m.updated_at
  from app.membership m
  join app."user" u on u.id = m.user_id
  order by m.updated_at desc
$$;

revoke all on function app.membership_admin_view() from public, anon, authenticated;
grant execute on function app.membership_admin_view() to offerlab_app;

comment on function app.membership_admin_view() is
  'Administrator-only membership listing for the membership operations screen.';

commit;
