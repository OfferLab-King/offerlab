begin;

create table app.career_job_target (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  provider text not null default 'manual',
  provider_job_id text,
  source_publisher text,
  role_title text not null,
  company_name text not null,
  location text,
  employment_type text,
  description text not null,
  apply_url text,
  source_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_job_target_owner_id_unique unique(owner_user_id,id),
  constraint career_job_target_provider_check check(provider in ('manual','jsearch')),
  constraint career_job_target_provider_identity_check check(
    (provider='manual' and provider_job_id is null and fetched_at is null)
    or (provider='jsearch' and provider_job_id is not null and fetched_at is not null)
  ),
  constraint career_job_target_text_check check(
    role_title=btrim(role_title) and char_length(role_title) between 1 and 160
    and company_name=btrim(company_name) and char_length(company_name) between 1 and 160
    and (location is null or (location=btrim(location) and char_length(location) between 1 and 200))
    and (employment_type is null or (employment_type=btrim(employment_type) and char_length(employment_type) between 1 and 80))
    and char_length(description) between 1 and 30000
    and (source_publisher is null or char_length(source_publisher) between 1 and 160)
  ),
  constraint career_job_target_url_check check(
    (apply_url is null or apply_url ~ '^https?://')
    and (source_url is null or source_url ~ '^https?://')
  ),
  constraint career_job_target_version_check check(version>0)
);

create unique index career_job_target_provider_identity_unique
  on app.career_job_target(owner_user_id,provider,provider_job_id)
  where provider_job_id is not null;
create index career_job_target_owner_active_idx
  on app.career_job_target(owner_user_id,updated_at desc)
  where archived_at is null;

create table app.job_search_usage (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  provider text not null,
  created_at timestamptz not null default now(),
  constraint job_search_usage_provider_check check(provider='jsearch')
);

create index job_search_usage_owner_created_idx
  on app.job_search_usage(owner_user_id,created_at desc);
create index job_search_usage_created_idx
  on app.job_search_usage(created_at desc);

create table app.career_document_review_usage (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  model_requested boolean not null,
  created_at timestamptz not null default now()
);

create index career_document_review_usage_owner_created_idx
  on app.career_document_review_usage(owner_user_id,created_at desc);
create index career_document_review_usage_hosted_created_idx
  on app.career_document_review_usage(created_at desc)
  where model_requested;

create table app.career_document (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  kind text not null,
  title text not null,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_document_owner_id_unique unique(owner_user_id,id),
  constraint career_document_kind_check check(kind in ('cv','cover_letter')),
  constraint career_document_title_check check(
    title=btrim(title) and char_length(title) between 1 and 160
  ),
  constraint career_document_version_check check(version>0)
);

create index career_document_owner_kind_active_idx
  on app.career_document(owner_user_id,kind,updated_at desc)
  where archived_at is null;

create table app.career_document_version (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  document_id uuid not null,
  revision integer not null,
  label text not null,
  content_text text not null,
  origin text not null,
  source_filename text,
  source_mime_type text,
  source_size_bytes integer,
  source_sha256 text,
  target_job_id uuid,
  target_role text,
  target_company text,
  job_description text not null default '',
  created_at timestamptz not null default now(),
  constraint career_document_version_owner_id_unique unique(owner_user_id,id),
  constraint career_document_version_document_fk foreign key(owner_user_id,document_id)
    references app.career_document(owner_user_id,id) on delete restrict,
  constraint career_document_version_target_fk foreign key(owner_user_id,target_job_id)
    references app.career_job_target(owner_user_id,id) on delete restrict,
  constraint career_document_version_identity_unique unique(document_id,revision),
  constraint career_document_version_revision_check check(revision>0),
  constraint career_document_version_label_check check(
    label=btrim(label) and char_length(label) between 1 and 160
  ),
  constraint career_document_version_content_check check(
    content_text=btrim(content_text) and char_length(content_text) between 40 and 60000
    and char_length(job_description)<=30000
  ),
  constraint career_document_version_origin_check check(origin in ('upload','editor','copy')),
  constraint career_document_version_source_check check(
    (
      origin in ('editor','copy')
      and
      pg_catalog.num_nonnulls(
        source_filename,source_mime_type,source_size_bytes,source_sha256
      )=0
    ) or (
      origin='upload'
      and
      pg_catalog.num_nonnulls(
        source_filename,source_mime_type,source_size_bytes,source_sha256
      )=4
      and source_filename=btrim(source_filename)
      and char_length(source_filename) between 1 and 255
      and source_mime_type in (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      and source_size_bytes between 1 and 5000000
      and source_sha256 ~ '^[a-f0-9]{64}$'
    )
  ),
  constraint career_document_version_target_check check(
    (target_role is null or (target_role=btrim(target_role) and char_length(target_role) between 1 and 160))
    and (target_company is null or (target_company=btrim(target_company) and char_length(target_company) between 1 and 160))
    and (
      job_description=''
      or (target_role is not null and target_company is not null)
    )
    and (target_job_id is null or job_description<>'')
  )
);

create index career_document_version_document_idx
  on app.career_document_version(owner_user_id,document_id,revision desc);
create index career_document_version_target_idx
  on app.career_document_version(owner_user_id,target_job_id)
  where target_job_id is not null;

create table app.career_document_review (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  document_version_id uuid not null,
  provider_id text not null,
  provider_mode text not null,
  model_requested boolean not null default false,
  provider_notice_version text,
  prompt_version integer not null,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  matched_requirements text[] not null default '{}',
  missing_requirements text[] not null default '{}',
  priority_actions jsonb not null default '[]'::jsonb,
  document_checks jsonb not null default '{}'::jsonb,
  suggested_content text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now(),
  constraint career_document_review_owner_id_unique unique(owner_user_id,id),
  constraint career_document_review_version_fk foreign key(owner_user_id,document_version_id)
    references app.career_document_version(owner_user_id,id) on delete restrict,
  constraint career_document_review_provider_check check(
    provider_mode in ('local','model','fallback')
    and provider_id=btrim(provider_id)
    and char_length(provider_id) between 1 and 80
  ),
  constraint career_document_review_notice_check check(
    (
      provider_mode='local'
      and not model_requested
      and provider_notice_version is null
    ) or (
      provider_mode in ('model','fallback')
      and model_requested
      and provider_notice_version=btrim(provider_notice_version)
      and char_length(provider_notice_version) between 1 and 80
    )
  ),
  constraint career_document_review_content_check check(
    summary=btrim(summary) and char_length(summary) between 1 and 600
    and jsonb_typeof(strengths)='array'
    and jsonb_typeof(priority_actions)='array'
    and jsonb_typeof(document_checks)='object'
    and jsonb_array_length(strengths)<=5
    and jsonb_array_length(priority_actions) between 1 and 8
    and cardinality(matched_requirements)<=20
    and cardinality(missing_requirements)<=20
    and (suggested_content is null or char_length(suggested_content) between 40 and 60000)
  ),
  constraint career_document_review_usage_check check(
    prompt_version>0
    and (input_tokens is null or input_tokens>=0)
    and (output_tokens is null or output_tokens>=0)
    and (latency_ms is null or latency_ms>=0)
  )
);

create index career_document_review_version_idx
  on app.career_document_review(owner_user_id,document_version_id,created_at desc);
create index career_document_review_usage_idx
  on app.career_document_review(owner_user_id,created_at desc);

create function app.control_career_workspace_mutation() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then
    new.version:=1;
    new.created_at:=clock_timestamp();
    new.updated_at:=new.created_at;
    return new;
  end if;
  new.created_at:=old.created_at;
  if to_jsonb(new)-'version'-'created_at'-'updated_at'
    is not distinct from to_jsonb(old)-'version'-'created_at'-'updated_at' then
    new.version:=old.version;
    new.updated_at:=old.updated_at;
  else
    new.version:=old.version+1;
    new.updated_at:=clock_timestamp();
  end if;
  return new;
end $$;

create function app.control_career_immutable_insert() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  new.created_at:=clock_timestamp();
  return new;
end $$;

create trigger career_job_target_control before insert or update on app.career_job_target
  for each row execute function app.control_career_workspace_mutation();
create trigger career_document_control before insert or update on app.career_document
  for each row execute function app.control_career_workspace_mutation();
create trigger career_document_version_control before insert on app.career_document_version
  for each row execute function app.control_career_immutable_insert();
create trigger career_document_review_control before insert on app.career_document_review
  for each row execute function app.control_career_immutable_insert();

create function app.reserve_job_search_usage(
  p_owner_user_id uuid,
  p_member_daily_limit integer,
  p_member_monthly_limit integer,
  p_account_monthly_limit integer
) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare
  account_monthly_count integer;
  member_daily_count integer;
  member_monthly_count integer;
begin
  if p_owner_user_id is distinct from app.current_user_id() then
    raise insufficient_privilege using message='job search owner context mismatch';
  end if;
  if p_member_daily_limit is null
    or p_member_monthly_limit is null
    or p_account_monthly_limit is null
    or least(p_member_daily_limit,p_member_monthly_limit,p_account_monthly_limit)<1
    or greatest(p_member_daily_limit,p_member_monthly_limit,p_account_monthly_limit)>100000 then
    raise check_violation using message='invalid job search usage limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('offerlab.job_search_usage',0)
  );
  select
    count(*) filter(
      where owner_user_id=p_owner_user_id
        and created_at>=pg_catalog.clock_timestamp()-interval '24 hours'
    )::integer,
    count(*) filter(
      where owner_user_id=p_owner_user_id
        and created_at>=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp())
    )::integer,
    count(*) filter(
      where created_at>=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp())
    )::integer
  into member_daily_count,member_monthly_count,account_monthly_count
  from app.job_search_usage;

  if member_daily_count>=p_member_daily_limit
    or member_monthly_count>=p_member_monthly_limit
    or account_monthly_count>=p_account_monthly_limit then
    return false;
  end if;

  insert into app.job_search_usage(owner_user_id,provider)
  values(p_owner_user_id,'jsearch');
  return true;
end $$;

create function app.reserve_career_document_review_usage(
  p_owner_user_id uuid,
  p_model_requested boolean,
  p_member_daily_limit integer,
  p_member_monthly_limit integer,
  p_hosted_account_monthly_limit integer
) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare
  hosted_account_monthly_count integer;
  member_daily_count integer;
  member_monthly_count integer;
begin
  if p_owner_user_id is distinct from app.current_user_id() then
    raise insufficient_privilege using message='career document review owner context mismatch';
  end if;
  if p_model_requested is null
    or p_member_daily_limit is null
    or p_member_monthly_limit is null
    or p_hosted_account_monthly_limit is null
    or least(
      p_member_daily_limit,p_member_monthly_limit,p_hosted_account_monthly_limit
    )<1
    or greatest(
      p_member_daily_limit,p_member_monthly_limit,p_hosted_account_monthly_limit
    )>100000 then
    raise check_violation using message='invalid career document review usage limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('offerlab.career_document_review_usage',0)
  );
  select
    count(*) filter(
      where owner_user_id=p_owner_user_id
        and created_at>=pg_catalog.clock_timestamp()-interval '24 hours'
    )::integer,
    count(*) filter(
      where owner_user_id=p_owner_user_id
        and created_at>=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp())
    )::integer,
    count(*) filter(
      where model_requested
        and created_at>=pg_catalog.date_trunc('month',pg_catalog.clock_timestamp())
    )::integer
  into member_daily_count,member_monthly_count,hosted_account_monthly_count
  from app.career_document_review_usage;

  if member_daily_count>=p_member_daily_limit
    or member_monthly_count>=p_member_monthly_limit
    or (
      p_model_requested
      and hosted_account_monthly_count>=p_hosted_account_monthly_limit
    ) then
    return false;
  end if;

  insert into app.career_document_review_usage(owner_user_id,model_requested)
  values(p_owner_user_id,p_model_requested);
  return true;
end $$;

alter table app.career_job_target enable row level security;
alter table app.career_job_target force row level security;
alter table app.job_search_usage enable row level security;
alter table app.job_search_usage force row level security;
alter table app.career_document_review_usage enable row level security;
alter table app.career_document_review_usage force row level security;
alter table app.career_document enable row level security;
alter table app.career_document force row level security;
alter table app.career_document_version enable row level security;
alter table app.career_document_version force row level security;
alter table app.career_document_review enable row level security;
alter table app.career_document_review force row level security;

create policy career_job_target_own on app.career_job_target for all to offerlab_app
  using(owner_user_id=app.current_user_id())
  with check(owner_user_id=app.current_user_id());
create policy job_search_usage_own on app.job_search_usage
  for select to offerlab_app using(owner_user_id=app.current_user_id());
create policy career_document_review_usage_own on app.career_document_review_usage
  for select to offerlab_app using(owner_user_id=app.current_user_id());
create policy career_document_own on app.career_document for all to offerlab_app
  using(owner_user_id=app.current_user_id())
  with check(owner_user_id=app.current_user_id());
create policy career_document_version_own on app.career_document_version
  for select to offerlab_app using(owner_user_id=app.current_user_id());
create policy career_document_version_insert_own on app.career_document_version
  for insert to offerlab_app with check(owner_user_id=app.current_user_id());
create policy career_document_review_own on app.career_document_review
  for select to offerlab_app using(owner_user_id=app.current_user_id());
create policy career_document_review_insert_own on app.career_document_review
  for insert to offerlab_app with check(owner_user_id=app.current_user_id());

create policy audit_event_insert_career_workspace on app.audit_event
  for insert to offerlab_app with check(
    actor_user_id=app.current_user_id() and metadata='{}'::jsonb and (
      (
        entity_type='career_job_target'
        and action in ('career_job.created','career_job.updated','career_job.archived','career_job.restored')
        and exists(
          select 1 from app.career_job_target j
          where j.id=entity_id and j.owner_user_id=app.current_user_id()
        )
      ) or (
        entity_type='career_document'
        and action in ('career_document.created','career_document.renamed','career_document.archived','career_document.restored')
        and exists(
          select 1 from app.career_document d
          where d.id=entity_id and d.owner_user_id=app.current_user_id()
        )
      ) or (
        entity_type='career_document_version'
        and action='career_document.version_created'
        and exists(
          select 1 from app.career_document_version v
          where v.id=entity_id and v.owner_user_id=app.current_user_id()
        )
      ) or (
        entity_type='career_document_review'
        and action='career_document.review_created'
        and exists(
          select 1 from app.career_document_review r
          where r.id=entity_id and r.owner_user_id=app.current_user_id()
        )
      )
    )
  );

grant select,insert,update on app.career_job_target,app.career_document to offerlab_app;
grant select,insert on app.career_document_version,app.career_document_review to offerlab_app;
grant select on app.job_search_usage,app.career_document_review_usage to offerlab_app;
grant execute on function app.reserve_job_search_usage(uuid,integer,integer,integer)
  to offerlab_app;
grant execute on function app.reserve_career_document_review_usage(
  uuid,boolean,integer,integer,integer
) to offerlab_app;

revoke all on app.career_job_target,app.career_document,app.career_document_version,
  app.career_document_review,app.job_search_usage,app.career_document_review_usage
  from public,anon,authenticated,offerlab_identity_sync;
revoke all on function app.control_career_workspace_mutation()
  from public,anon,authenticated,offerlab_identity_sync;
revoke all on function app.control_career_immutable_insert()
  from public,anon,authenticated,offerlab_identity_sync;
revoke all on function app.reserve_job_search_usage(uuid,integer,integer,integer)
  from public,anon,authenticated,offerlab_identity_sync;
revoke all on function app.reserve_career_document_review_usage(
  uuid,boolean,integer,integer,integer
) from public,anon,authenticated,offerlab_identity_sync;
grant execute on function app.control_career_workspace_mutation() to offerlab_app;
grant execute on function app.control_career_immutable_insert() to offerlab_app;

comment on table app.career_job_target is
  'Private owner-scoped role target. Provider listings require separately approved display and retention terms.';
comment on table app.job_search_usage is
  'Content-free provider request reservation used for member and account cost limits.';
comment on table app.career_document_review_usage is
  'Content-free review-attempt reservation used for member and hosted-model account cost limits.';
comment on table app.career_document is
  'Private owner-scoped CV or cover-letter lineage.';
comment on table app.career_document_version is
  'Immutable extracted or edited document snapshot; original binary uploads are not persisted.';
comment on table app.career_document_review is
  'Immutable bounded review output and non-content provider telemetry.';

commit;
