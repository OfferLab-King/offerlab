begin;

create table app.group_mock_material (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  title text not null,
  summary text not null,
  sector text not null,
  exercise_type text not null,
  difficulty text not null,
  recommended_minutes integer not null,
  scenario text not null,
  participant_instructions text not null,
  information_pack text not null,
  deliverable text not null,
  observer_rubric text not null,
  debrief_questions text[] not null,
  publication_state text not null default 'draft',
  source_kind text not null default 'offerlab_original',
  originality_confirmed_at timestamptz not null,
  originality_confirmed_by_user_id uuid not null references app."user"(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_mock_material_key_check check(stable_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  constraint group_mock_material_title_check check(title=btrim(title) and char_length(title) between 1 and 160),
  constraint group_mock_material_summary_check check(summary=btrim(summary) and char_length(summary) between 1 and 500),
  constraint group_mock_material_sector_check check(sector in ('accounting_professional_services','consulting','financial_services','general_corporate')),
  constraint group_mock_material_type_check check(exercise_type in ('prioritisation','case_discussion','role_play','written_brief')),
  constraint group_mock_material_difficulty_check check(difficulty in ('introductory','standard','advanced')),
  constraint group_mock_material_minutes_check check(recommended_minutes between 30 and 120),
  constraint group_mock_material_body_check check(
    scenario=btrim(scenario) and char_length(scenario) between 20 and 10000 and
    participant_instructions=btrim(participant_instructions) and char_length(participant_instructions) between 20 and 5000 and
    information_pack=btrim(information_pack) and char_length(information_pack) between 20 and 30000 and
    deliverable=btrim(deliverable) and char_length(deliverable) between 10 and 3000 and
    observer_rubric=btrim(observer_rubric) and char_length(observer_rubric) between 20 and 10000 and
    cardinality(debrief_questions) between 2 and 10
  ),
  constraint group_mock_material_debrief_check check(array_position(debrief_questions,'') is null),
  constraint group_mock_material_publication_check check(publication_state in ('draft','published','archived')),
  constraint group_mock_material_source_check check(source_kind='offerlab_original'),
  constraint group_mock_material_version_check check(version>0)
);

create table app.group_mock_session (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references app.group_mock_material(id) on delete restrict,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  minimum_participants integer not null,
  capacity integer not null,
  access_mode text not null,
  price_pence integer,
  payment_url text,
  state text not null default 'draft',
  facilitator_mode text not null default 'offerlab',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_mock_session_title_check check(title=btrim(title) and char_length(title) between 1 and 160),
  constraint group_mock_session_schedule_check check(ends_at>starts_at and ends_at<=starts_at+interval '3 hours'),
  constraint group_mock_session_capacity_check check(minimum_participants between 3 and capacity and capacity between 3 and 8),
  constraint group_mock_session_access_check check(
    (access_mode='member_included' and price_pence is null and payment_url is null) or
    (access_mode='manual_payment' and price_pence between 100 and 100000 and payment_url ~ '^https://[^[:space:]]+$')
  ),
  constraint group_mock_session_state_check check(state in ('draft','open','closed','completed','cancelled')),
  constraint group_mock_session_facilitator_check check(facilitator_mode='offerlab'),
  constraint group_mock_session_version_check check(version>0)
);

create table app.group_mock_booking (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references app.group_mock_session(id) on delete restrict,
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  status text not null,
  age_eligibility_confirmed_at timestamptz not null,
  participation_rules_version text not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_mock_booking_identity_unique unique(owner_user_id,session_id),
  constraint group_mock_booking_owner_id_unique unique(owner_user_id,id),
  constraint group_mock_booking_status_check check(status in ('payment_pending','confirmed','waitlisted','cancelled','attended','no_show')),
  constraint group_mock_booking_rules_check check(participation_rules_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint group_mock_booking_version_check check(version>0)
);

create table app.group_mock_session_meeting (
  session_id uuid primary key references app.group_mock_session(id) on delete cascade,
  provider text not null,
  join_url text not null,
  joining_instructions text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_mock_meeting_provider_check check(provider in ('zoom','external')),
  constraint group_mock_meeting_url_check check(join_url ~ '^https://[^[:space:]]+$'),
  constraint group_mock_meeting_instructions_check check(joining_instructions is null or (joining_instructions=btrim(joining_instructions) and char_length(joining_instructions) between 1 and 500)),
  constraint group_mock_meeting_version_check check(version>0)
);

create function app.control_group_mock_editorial() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then
    new.version:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new;
  end if;
  new.created_at:=old.created_at;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from
     to_jsonb(old)-'version'-'created_at'-'updated_at' then
    new.version:=old.version; new.updated_at:=old.updated_at;
  else
    new.version:=old.version+1; new.updated_at:=clock_timestamp();
  end if;
  return new;
end $$;

create function app.control_group_mock_booking() returns trigger
language plpgsql security definer set search_path=pg_catalog,app as $$
declare
  session_row app.group_mock_session%rowtype;
  occupied integer;
  actor_is_admin boolean;
begin
  if tg_op='INSERT' then
    select * into session_row from app.group_mock_session where id=new.session_id for update;
    if not found or session_row.state<>'open' or session_row.starts_at<=clock_timestamp() then
      raise exception 'group_mock_session_unavailable' using errcode='23514';
    end if;
    if new.owner_user_id is distinct from app.current_user_id() or new.age_eligibility_confirmed_at is null then
      raise exception 'group_mock_booking_identity_invalid' using errcode='23514';
    end if;
    select count(*) into occupied from app.group_mock_booking
      where session_id=new.session_id and status in ('payment_pending','confirmed');
    if occupied>=session_row.capacity then
      new.status:='waitlisted';
    elsif session_row.access_mode='manual_payment' then
      new.status:='payment_pending';
    else
      new.status:='confirmed';
    end if;
    new.version:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new;
  end if;
  new.created_at:=old.created_at;
  new.owner_user_id:=old.owner_user_id;
  new.session_id:=old.session_id;
  new.age_eligibility_confirmed_at:=old.age_eligibility_confirmed_at;
  new.participation_rules_version:=old.participation_rules_version;
  select exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
    into actor_is_admin;
  actor_is_admin:=actor_is_admin or pg_trigger_depth()>1;
  if not actor_is_admin then
    if old.owner_user_id is distinct from app.current_user_id() then
      raise exception 'group_mock_booking_identity_invalid' using errcode='23514';
    end if;
    if old.status='cancelled' and new.status<>'cancelled' then
      select * into session_row from app.group_mock_session where id=new.session_id for update;
      if not found or session_row.state<>'open' or session_row.starts_at<=clock_timestamp() then
        raise exception 'group_mock_session_unavailable' using errcode='23514';
      end if;
      select count(*) into occupied from app.group_mock_booking
        where session_id=new.session_id and status in ('payment_pending','confirmed');
      if occupied>=session_row.capacity then new.status:='waitlisted';
      elsif session_row.access_mode='manual_payment' then new.status:='payment_pending';
      else new.status:='confirmed'; end if;
    elsif new.status<>'cancelled' then
      raise exception 'group_mock_booking_member_transition_invalid' using errcode='23514';
    end if;
  end if;
  if old.status in ('payment_pending','confirmed') and new.status='cancelled' then
    select * into session_row from app.group_mock_session where id=new.session_id for update;
    if session_row.state='open' and session_row.starts_at>clock_timestamp() then
      update app.group_mock_booking set status=case
        when session_row.access_mode='manual_payment' then 'payment_pending' else 'confirmed' end
      where id=(select id from app.group_mock_booking where session_id=new.session_id and status='waitlisted'
        order by created_at,id for update skip locked limit 1);
    end if;
  end if;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from
     to_jsonb(old)-'version'-'created_at'-'updated_at' then
    new.version:=old.version; new.updated_at:=old.updated_at;
  else
    new.version:=old.version+1; new.updated_at:=clock_timestamp();
  end if;
  return new;
end $$;

create trigger group_mock_material_control before insert or update on app.group_mock_material
for each row execute function app.control_group_mock_editorial();
create trigger group_mock_session_control before insert or update on app.group_mock_session
for each row execute function app.control_group_mock_editorial();
create trigger group_mock_meeting_control before insert or update on app.group_mock_session_meeting
for each row execute function app.control_group_mock_editorial();
create trigger group_mock_booking_control before insert or update on app.group_mock_booking
for each row execute function app.control_group_mock_booking();

create index group_mock_material_published_idx on app.group_mock_material(publication_state,sector,difficulty,title,id);
create index group_mock_session_lobby_idx on app.group_mock_session(state,starts_at,id);
create index group_mock_booking_session_idx on app.group_mock_booking(session_id,status,created_at,id);
create index group_mock_booking_owner_idx on app.group_mock_booking(owner_user_id,created_at desc,id);

create function app.group_mock_session_counts(target_session_id uuid)
returns table(confirmed_count bigint,waiting_count bigint)
language sql stable security definer set search_path=pg_catalog,app as $$
  select
    count(*) filter(where b.status='confirmed') as confirmed_count,
    count(*) filter(where b.status='waitlisted') as waiting_count
  from app.group_mock_booking b
  where b.session_id=target_session_id
    and exists(select 1 from app."user" u where u.id=app.current_user_id())
$$;

alter table app.group_mock_material enable row level security;
alter table app.group_mock_material force row level security;
alter table app.group_mock_session enable row level security;
alter table app.group_mock_session force row level security;
alter table app.group_mock_booking enable row level security;
alter table app.group_mock_booking force row level security;
alter table app.group_mock_session_meeting enable row level security;
alter table app.group_mock_session_meeting force row level security;

create policy group_mock_material_read on app.group_mock_material for select to offerlab_app using(
  publication_state='published' or exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy group_mock_material_admin_write on app.group_mock_material for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy group_mock_session_read on app.group_mock_session for select to offerlab_app using(
  state in ('open','closed','completed') or
  exists(select 1 from app.group_mock_booking b where b.session_id=id and b.owner_user_id=app.current_user_id()) or
  exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy group_mock_session_admin_write on app.group_mock_session for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy group_mock_booking_read on app.group_mock_booking for select to offerlab_app using(
  owner_user_id=app.current_user_id() or
  exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy group_mock_booking_member_insert on app.group_mock_booking for insert to offerlab_app with check(
  owner_user_id=app.current_user_id() and age_eligibility_confirmed_at is not null and
  participation_rules_version='2026-07-27'
);
create policy group_mock_booking_member_cancel on app.group_mock_booking for update to offerlab_app
  using(owner_user_id=app.current_user_id() and status in ('payment_pending','confirmed','waitlisted','cancelled'))
  with check(owner_user_id=app.current_user_id() and status in ('payment_pending','confirmed','waitlisted','cancelled'));
create policy group_mock_booking_admin_update on app.group_mock_booking for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy group_mock_meeting_admin_all on app.group_mock_session_meeting for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy group_mock_meeting_confirmed_read on app.group_mock_session_meeting for select to offerlab_app using(
  exists(
    select 1 from app.group_mock_session s join app.group_mock_booking b on b.session_id=s.id
    where s.id=session_id and b.owner_user_id=app.current_user_id() and b.status='confirmed' and
      clock_timestamp()>=s.starts_at-interval '15 minutes' and clock_timestamp()<s.ends_at
  )
);

grant select,insert,update on app.group_mock_material,app.group_mock_session,app.group_mock_booking to offerlab_app;
grant select,insert,update,delete on app.group_mock_session_meeting to offerlab_app;
revoke all on app.group_mock_material,app.group_mock_session,app.group_mock_booking,app.group_mock_session_meeting
  from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
revoke all on function app.control_group_mock_editorial(),app.control_group_mock_booking(),app.group_mock_session_counts(uuid)
  from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
grant execute on function app.control_group_mock_editorial(),app.control_group_mock_booking(),app.group_mock_session_counts(uuid) to offerlab_app;

drop policy audit_event_insert_phase_one on app.audit_event;
create policy audit_event_insert_phase_one on app.audit_event for insert to offerlab_app with check(
  actor_user_id=app.current_user_id() and metadata='{}'::jsonb and (
    (entity_type='recruitment_intelligence_report' and action in ('intelligence.submitted','intelligence.updated','intelligence.published','intelligence.rejected') and exists(select 1 from app.recruitment_intelligence_report r where r.id=entity_id)) or
    (entity_type='recruitment_intelligence_comment' and action in ('intelligence.comment_submitted','intelligence.comment_published','intelligence.comment_rejected','intelligence.comment_removed') and exists(select 1 from app.recruitment_intelligence_comment c where c.id=entity_id)) or
    (entity_type='recruitment_intelligence_comment_flag' and action in ('intelligence.comment_flagged','intelligence.comment_flag_dismissed') and exists(select 1 from app.recruitment_intelligence_comment_flag f where f.id=entity_id)) or
    (entity_type='member_community_agreement' and action='community.agreement_accepted' and entity_id=actor_user_id and exists(select 1 from app.member_community_agreement a where a.owner_user_id=entity_id)) or
    (entity_type='service_request' and action in ('service.requested','service.cancelled','service.confirmed','service.completed') and exists(select 1 from app.service_request r where r.id=entity_id)) or
    (entity_type='service_offering' and action='service.availability_updated' and exists(select 1 from app.service_offering o where o.id=entity_id) and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) or
    (entity_type='group_mock_material' and action in ('group_mock.material_created','group_mock.material_updated') and exists(select 1 from app.group_mock_material m where m.id=entity_id) and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) or
    (entity_type='group_mock_session' and action in ('group_mock.session_created','group_mock.session_updated') and exists(select 1 from app.group_mock_session s where s.id=entity_id) and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) or
    (entity_type='group_mock_booking' and action in ('group_mock.booking_created','group_mock.booking_cancelled','group_mock.booking_updated') and exists(select 1 from app.group_mock_booking b where b.id=entity_id))
  )
);

comment on table app.group_mock_material is 'Original OfferLab group-exercise materials; never copied employer assessments.';
comment on table app.group_mock_session is 'OfferLab-scheduled, fixed-duration Group Mock room metadata without provider credentials.';
comment on table app.group_mock_booking is 'Owner-scoped 18+ seat, waitlist and manually confirmed payment state.';
comment on table app.group_mock_session_meeting is 'Protected external meeting URL visible only to administrators or confirmed members in the join window.';

commit;
