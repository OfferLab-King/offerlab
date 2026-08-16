begin;

-- Answer Coach usage reservation.
--
-- Mirrors the career-document review reservation pattern: a review slot is
-- reserved atomically (with a short advisory lock) in its own transaction
-- before the provider call, so per-member review capacity is enforced without
-- holding a database transaction open across provider latency. A reserved
-- slot is consumed even if the provider call later falls back to the local
-- rubric, matching the fact that every completed review is stored.

create table app.answer_coach_review_usage (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete cascade,
  model_requested boolean not null default false,
  created_at timestamptz not null default now()
);

create index answer_coach_review_usage_owner_time
  on app.answer_coach_review_usage (owner_user_id, created_at desc);

comment on table app.answer_coach_review_usage is
  'Atomic per-member Answer Coach review reservations; capacity accounting lives here, review content lives in answer_coach_review.';

create function app.reserve_answer_coach_review_usage(
  p_owner_user_id uuid,
  p_recent_limit integer,
  p_monthly_limit integer
) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare
  recent_count integer;
  monthly_count integer;
begin
  if p_owner_user_id is distinct from app.current_user_id() then
    raise insufficient_privilege using message = 'answer coach review owner context mismatch';
  end if;
  if p_recent_limit is null or p_monthly_limit is null
    or least(p_recent_limit, p_monthly_limit) < 1
    or greatest(p_recent_limit, p_monthly_limit) > 100000 then
    raise check_violation using message = 'invalid answer coach review usage limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('offerlab.answer_coach_review_usage', 0)
  );
  select
    count(*) filter (
      where owner_user_id = p_owner_user_id
        and created_at >= pg_catalog.clock_timestamp() - interval '10 minutes'
    )::integer,
    count(*) filter (
      where owner_user_id = p_owner_user_id
        and created_at >= pg_catalog.date_trunc('month', pg_catalog.clock_timestamp())
    )::integer
  into recent_count, monthly_count
  from app.answer_coach_review_usage;

  if recent_count >= p_recent_limit then
    return 'recent';
  end if;
  if monthly_count >= p_monthly_limit then
    return 'monthly';
  end if;

  insert into app.answer_coach_review_usage(owner_user_id)
  values (p_owner_user_id);
  return 'ok';
end $$;

alter table app.answer_coach_review_usage enable row level security;
alter table app.answer_coach_review_usage force row level security;

create policy answer_coach_review_usage_own_select
  on app.answer_coach_review_usage
  for select
  to offerlab_app
  using (owner_user_id = app.current_user_id());

create policy answer_coach_review_usage_own_insert
  on app.answer_coach_review_usage
  for insert
  to offerlab_app
  with check (owner_user_id = app.current_user_id());

revoke all on app.answer_coach_review_usage from public, anon, authenticated;
revoke all on app.answer_coach_review_usage from offerlab_identity_sync;
grant select, insert on app.answer_coach_review_usage to offerlab_app;
grant execute on function app.reserve_answer_coach_review_usage(uuid, integer, integer) to offerlab_app;
commit;