begin;

create table app.member_community_agreement (
  owner_user_id uuid primary key references app."user"(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_community_agreement_version_check
    check(terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

create table app.recruitment_intelligence_comment (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references app.recruitment_intelligence_report(id) on delete cascade,
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  parent_comment_id uuid,
  body text not null,
  moderation_state text not null default 'pending',
  moderated_by_user_id uuid references app."user"(id) on delete restrict,
  moderated_at timestamptz,
  moderator_note text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruitment_intelligence_comment_report_id_unique unique(report_id,id),
  constraint recruitment_intelligence_comment_owner_id_unique unique(owner_user_id,id),
  constraint recruitment_intelligence_comment_parent_fk
    foreign key(report_id,parent_comment_id)
    references app.recruitment_intelligence_comment(report_id,id) on delete cascade,
  constraint recruitment_intelligence_comment_body_check
    check(body=btrim(body) and char_length(body) between 2 and 1000),
  constraint recruitment_intelligence_comment_state_check
    check(moderation_state in ('pending','published','rejected','removed')),
  constraint recruitment_intelligence_comment_lifecycle_check check(
    (moderation_state='pending' and moderated_by_user_id is null and moderated_at is null and moderator_note is null) or
    (moderation_state in ('published','rejected','removed') and moderated_by_user_id is not null and moderated_at is not null)
  ),
  constraint recruitment_intelligence_comment_note_check
    check(moderator_note is null or (moderator_note=btrim(moderator_note) and char_length(moderator_note) between 1 and 500)),
  constraint recruitment_intelligence_comment_version_check check(version>0)
);

create table app.recruitment_intelligence_comment_flag (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references app.recruitment_intelligence_comment(id) on delete cascade,
  owner_user_id uuid not null references app."user"(id) on delete cascade,
  reason text not null,
  resolution text,
  resolved_by_user_id uuid references app."user"(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recruitment_intelligence_comment_flag_unique unique(comment_id,owner_user_id),
  constraint recruitment_intelligence_comment_flag_reason_check
    check(reason in ('confidentiality','personal_information','inaccurate','abusive','copyright','other')),
  constraint recruitment_intelligence_comment_flag_resolution_check
    check(resolution is null or resolution in ('dismissed','content_removed')),
  constraint recruitment_intelligence_comment_flag_lifecycle_check check(
    (resolution is null and resolved_by_user_id is null and resolved_at is null) or
    (resolution is not null and resolved_by_user_id is not null and resolved_at is not null)
  )
);

create function app.control_intelligence_comment() returns trigger
language plpgsql set search_path=pg_catalog,app as $$
declare
  parent_parent uuid;
  report_state text;
begin
  if tg_op='INSERT' then
    select moderation_state into report_state
    from app.recruitment_intelligence_report where id=new.report_id;
    if report_state is distinct from 'published' then
      raise exception 'intelligence_report_not_published' using errcode='23514';
    end if;
    if new.parent_comment_id is not null then
      select parent_comment_id into parent_parent
      from app.recruitment_intelligence_comment
      where report_id=new.report_id and id=new.parent_comment_id and moderation_state='published';
      if not found or parent_parent is not null then
        raise exception 'intelligence_comment_invalid_parent' using errcode='23514';
      end if;
    end if;
    new.version:=1;
    new.created_at:=clock_timestamp();
    new.updated_at:=new.created_at;
    return new;
  end if;
  new.created_at:=old.created_at;
  new.report_id:=old.report_id;
  new.owner_user_id:=old.owner_user_id;
  new.parent_comment_id:=old.parent_comment_id;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from
     to_jsonb(old)-'version'-'created_at'-'updated_at' then
    new.version:=old.version;
    new.updated_at:=old.updated_at;
  else
    new.version:=old.version+1;
    new.updated_at:=clock_timestamp();
  end if;
  return new;
end $$;

create trigger recruitment_intelligence_comment_control
before insert or update on app.recruitment_intelligence_comment
for each row execute function app.control_intelligence_comment();

create index recruitment_intelligence_comment_report_idx
  on app.recruitment_intelligence_comment(report_id,moderation_state,created_at,id);
create index recruitment_intelligence_comment_owner_rate_idx
  on app.recruitment_intelligence_comment(owner_user_id,created_at desc);
create index recruitment_intelligence_comment_moderation_idx
  on app.recruitment_intelligence_comment(moderation_state,created_at,id);
create index recruitment_intelligence_comment_flag_open_idx
  on app.recruitment_intelligence_comment_flag(comment_id,created_at,id)
  where resolution is null;

alter table app.member_community_agreement enable row level security;
alter table app.member_community_agreement force row level security;
alter table app.recruitment_intelligence_comment enable row level security;
alter table app.recruitment_intelligence_comment force row level security;
alter table app.recruitment_intelligence_comment_flag enable row level security;
alter table app.recruitment_intelligence_comment_flag force row level security;

create policy community_agreement_own on app.member_community_agreement
  for all to offerlab_app
  using(owner_user_id=app.current_user_id())
  with check(owner_user_id=app.current_user_id());
create policy community_agreement_admin_read on app.member_community_agreement
  for select to offerlab_app using(
    exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
  );

create policy intelligence_comment_read on app.recruitment_intelligence_comment
  for select to offerlab_app using(
    owner_user_id=app.current_user_id() or
    (app.current_user_id() is not null and moderation_state='published') or
    exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
  );
create policy intelligence_comment_member_submit on app.recruitment_intelligence_comment
  for insert to offerlab_app with check(
    owner_user_id=app.current_user_id() and moderation_state='pending' and
    moderated_by_user_id is null and moderated_at is null and moderator_note is null and
    exists(select 1 from app.member_community_agreement a where a.owner_user_id=app.current_user_id()) and
    exists(select 1 from app.recruitment_intelligence_report r where r.id=report_id and r.moderation_state='published')
  );
create policy intelligence_comment_admin_moderate on app.recruitment_intelligence_comment
  for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy intelligence_comment_flag_read on app.recruitment_intelligence_comment_flag
  for select to offerlab_app using(
    owner_user_id=app.current_user_id() or
    exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
  );
create policy intelligence_comment_flag_member_submit on app.recruitment_intelligence_comment_flag
  for insert to offerlab_app with check(
    owner_user_id=app.current_user_id() and resolution is null and
    exists(select 1 from app.recruitment_intelligence_comment c where c.id=comment_id and c.moderation_state='published')
  );
create policy intelligence_comment_flag_admin_resolve on app.recruitment_intelligence_comment_flag
  for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

grant select,insert,update on app.member_community_agreement to offerlab_app;
grant select,insert,update on app.recruitment_intelligence_comment to offerlab_app;
grant select,insert,update on app.recruitment_intelligence_comment_flag to offerlab_app;
revoke all on app.member_community_agreement,app.recruitment_intelligence_comment,
  app.recruitment_intelligence_comment_flag
  from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
revoke all on function app.control_intelligence_comment()
  from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
grant execute on function app.control_intelligence_comment() to offerlab_app;

drop policy audit_event_insert_phase_one on app.audit_event;
create policy audit_event_insert_phase_one on app.audit_event for insert to offerlab_app with check(
  actor_user_id=app.current_user_id() and metadata='{}'::jsonb and (
    (entity_type='recruitment_intelligence_report' and
      action in ('intelligence.submitted','intelligence.updated','intelligence.published','intelligence.rejected') and
      exists(select 1 from app.recruitment_intelligence_report r where r.id=entity_id)) or
    (entity_type='recruitment_intelligence_comment' and
      action in ('intelligence.comment_submitted','intelligence.comment_published','intelligence.comment_rejected','intelligence.comment_removed') and
      exists(select 1 from app.recruitment_intelligence_comment c where c.id=entity_id)) or
    (entity_type='recruitment_intelligence_comment_flag' and
      action in ('intelligence.comment_flagged','intelligence.comment_flag_dismissed') and
      exists(select 1 from app.recruitment_intelligence_comment_flag f where f.id=entity_id)) or
    (entity_type='member_community_agreement' and action='community.agreement_accepted' and
      entity_id=actor_user_id and exists(select 1 from app.member_community_agreement a where a.owner_user_id=entity_id)) or
    (entity_type='service_request' and
      action in ('service.requested','service.cancelled','service.confirmed','service.completed') and
      exists(select 1 from app.service_request r where r.id=entity_id)) or
    (entity_type='service_offering' and action='service.availability_updated' and
      exists(select 1 from app.service_offering o where o.id=entity_id) and
      exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  )
);

comment on table app.member_community_agreement is
  'Versioned acceptance required before a member contributes Recruitment Intelligence discussion.';
comment on table app.recruitment_intelligence_comment is
  'Member-only, pre-moderated supporting discussion attached to a structured Intelligence report.';
comment on table app.recruitment_intelligence_comment_flag is
  'Privacy-minimal member reports of published Intelligence comments for administrator review.';

commit;
