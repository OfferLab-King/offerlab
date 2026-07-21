begin;

create table app.content_category (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, description text, archived_at timestamptz,
  version integer not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_category_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  constraint content_category_name_check check (length(name) between 1 and 80),
  constraint content_category_description_check check (description is null or length(description) <= 500),
  constraint content_category_version_check check (version > 0)
);
create unique index content_category_name_ci_idx on app.content_category(lower(name));

create table app.content_tag (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, normalized_name text not null unique, archived_at timestamptz,
  version integer not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_tag_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  constraint content_tag_name_check check (length(name) between 1 and 60),
  constraint content_tag_version_check check (version > 0)
);

create table app.preparation_resource (
  id uuid primary key default gen_random_uuid(), resource_key text not null unique,
  slug text not null unique, title text not null, short_description text not null,
  resource_type text not null, access_level text not null, publication_state text not null default 'draft',
  markdown_body text not null default '', primary_category_id uuid references app.content_category(id) on delete restrict,
  estimated_minutes integer, youtube_video_id text, first_published_at timestamptz,
  published_at timestamptz, archived_at timestamptz, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search_document tsvector generated always as
    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(markdown_body,''))) stored,
  constraint preparation_resource_key_check check (resource_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  constraint preparation_resource_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  constraint preparation_resource_title_check check (length(title) <= 160 and (publication_state <> 'published' or length(title) >= 1)),
  constraint preparation_resource_summary_check check (length(short_description) <= 500 and (publication_state <> 'published' or length(short_description) >= 1)),
  constraint preparation_resource_body_check check (length(markdown_body) <= 100000),
  constraint preparation_resource_type_check check (resource_type in ('guide','checklist','template','video','exercise','article')),
  constraint preparation_resource_access_check check (access_level in ('public','member')),
  constraint preparation_resource_state_check check (publication_state in ('draft','published','archived')),
  constraint preparation_resource_minutes_check check (estimated_minutes is null or estimated_minutes between 1 and 600),
  constraint preparation_resource_video_check check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint preparation_resource_version_check check (version > 0),
  constraint preparation_resource_lifecycle_check check (
    (publication_state='draft' and published_at is null and archived_at is null) or
    (publication_state='published' and published_at is not null and archived_at is null) or
    (publication_state='archived' and published_at is null and archived_at is not null)
  )
);
create index preparation_resource_search_idx on app.preparation_resource using gin(search_document);
create index preparation_resource_catalogue_idx on app.preparation_resource(publication_state, access_level, primary_category_id, title, id);

create table app.preparation_resource_tag (
  resource_id uuid not null references app.preparation_resource(id) on delete cascade,
  tag_id uuid not null references app.content_tag(id) on delete restrict,
  primary key(resource_id, tag_id)
);
create table app.preparation_resource_stage (
  resource_id uuid not null references app.preparation_resource(id) on delete cascade,
  stage text not null, primary key(resource_id, stage),
  constraint preparation_resource_stage_check check (stage in ('preparing','applied','online_assessment','video_interview','interview','assessment_centre','offer','rejected','withdrawn'))
);
create table app.preparation_resource_opportunity_type (
  resource_id uuid not null references app.preparation_resource(id) on delete cascade,
  opportunity_type text not null, primary key(resource_id, opportunity_type),
  constraint preparation_resource_opportunity_check check (opportunity_type in ('graduate_scheme','internship','placement','entry_level_role'))
);
create table app.preparation_resource_relation (
  resource_id uuid not null references app.preparation_resource(id) on delete cascade,
  related_resource_id uuid not null references app.preparation_resource(id) on delete restrict,
  position integer not null, primary key(resource_id, related_resource_id),
  unique(resource_id, position), constraint preparation_resource_relation_self_check check(resource_id <> related_resource_id),
  constraint preparation_resource_relation_position_check check(position between 1 and 20)
);
create table app.preparation_resource_link (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references app.preparation_resource(id) on delete cascade,
  link_type text not null, label text not null, url text not null, position integer not null,
  unique(resource_id, position), unique(resource_id, link_type, url),
  constraint preparation_resource_link_type_check check(link_type in ('download','external','template_copy')),
  constraint preparation_resource_link_label_check check(length(label) between 1 and 120),
  constraint preparation_resource_link_url_check check(length(url) <= 2048 and (url like 'https://%' or url ~ '^/[A-Za-z0-9/_?&=.#%-]*$')),
  constraint preparation_resource_link_position_check check(position between 1 and 20)
);

create table app.member_resource_state (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references app."user"(id) on delete restrict,
  resource_id uuid not null references app.preparation_resource(id) on delete restrict,
  saved_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(owner_user_id, resource_id)
);

create function app.control_versioned_content_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then new.version:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new; end if;
  new.created_at:=old.created_at;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from to_jsonb(old)-'version'-'created_at'-'updated_at'
    then new.version:=old.version; new.updated_at:=old.updated_at;
    else new.version:=old.version+1; new.updated_at:=clock_timestamp();
  end if; return new;
end $$;
create trigger preparation_resource_control before insert or update on app.preparation_resource for each row execute function app.control_versioned_content_mutation();
create trigger content_category_control before insert or update on app.content_category for each row execute function app.control_versioned_content_mutation();
create trigger content_tag_control before insert or update on app.content_tag for each row execute function app.control_versioned_content_mutation();

create function app.control_member_resource_state() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new; end if;
 if new.id<>old.id or new.owner_user_id<>old.owner_user_id or new.resource_id<>old.resource_id then raise exception 'member_resource_state_identity_is_immutable'; end if;
 new.created_at:=old.created_at;
 if new.saved_at is not distinct from old.saved_at and new.completed_at is not distinct from old.completed_at then new.updated_at:=old.updated_at; else new.updated_at:=clock_timestamp(); end if;
 return new;
end $$;
create trigger member_resource_state_control before insert or update on app.member_resource_state for each row execute function app.control_member_resource_state();

alter table app.content_category enable row level security; alter table app.content_category force row level security;
alter table app.content_tag enable row level security; alter table app.content_tag force row level security;
alter table app.preparation_resource enable row level security; alter table app.preparation_resource force row level security;
alter table app.preparation_resource_tag enable row level security; alter table app.preparation_resource_tag force row level security;
alter table app.preparation_resource_stage enable row level security; alter table app.preparation_resource_stage force row level security;
alter table app.preparation_resource_opportunity_type enable row level security; alter table app.preparation_resource_opportunity_type force row level security;
alter table app.preparation_resource_relation enable row level security; alter table app.preparation_resource_relation force row level security;
alter table app.preparation_resource_link enable row level security; alter table app.preparation_resource_link force row level security;
alter table app.member_resource_state enable row level security; alter table app.member_resource_state force row level security;

create policy global_content_read_categories on app.content_category for select to offerlab_app using(true);
create policy global_content_read_tags on app.content_tag for select to offerlab_app using(true);
create policy global_content_read_resources on app.preparation_resource for select to offerlab_app using(
  publication_state='published' or exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy global_content_read_resource_tags on app.preparation_resource_tag for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id)
);
create policy global_content_read_resource_stages on app.preparation_resource_stage for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id)
);
create policy global_content_read_resource_opportunities on app.preparation_resource_opportunity_type for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id)
);
create policy global_content_read_resource_relations on app.preparation_resource_relation for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id)
);
create policy global_content_read_resource_links on app.preparation_resource_link for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id)
);
create policy admin_content_categories_write on app.content_category for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_content_tags_write on app.content_tag for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resources_write on app.preparation_resource for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resource_tags_write on app.preparation_resource_tag for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resource_stages_write on app.preparation_resource_stage for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resource_opportunities_write on app.preparation_resource_opportunity_type for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resource_relations_write on app.preparation_resource_relation for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy admin_resource_links_write on app.preparation_resource_link for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy member_resource_state_select_own on app.member_resource_state for select to offerlab_app using(owner_user_id=app.current_user_id());
create policy member_resource_state_insert_own on app.member_resource_state for insert to offerlab_app with check(owner_user_id=app.current_user_id());
create policy member_resource_state_update_own on app.member_resource_state for update to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());

create policy audit_event_insert_resource_state on app.audit_event for insert to offerlab_app with check(
 actor_user_id=app.current_user_id() and entity_type='member_resource_state' and action in ('resource.saved','resource.unsaved','resource.completed','resource.marked_incomplete') and metadata='{}'::jsonb
 and exists(select 1 from app.member_resource_state s where s.id=entity_id and s.owner_user_id=app.current_user_id())
);
create policy audit_event_insert_content on app.audit_event for insert to offerlab_app with check(
 actor_user_id=app.current_user_id() and entity_type in ('preparation_resource','content_category','content_tag')
 and action in ('content.created','content.updated','content.published','content.unpublished','content.archived','content.restored','content_category.created','content_category.updated','content_category.archived','content_category.restored','content_tag.created','content_tag.updated','content_tag.archived','content_tag.restored')
 and metadata='{}'::jsonb and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);

revoke all on app.content_category, app.content_tag, app.preparation_resource, app.preparation_resource_tag,
 app.preparation_resource_stage, app.preparation_resource_opportunity_type, app.preparation_resource_relation,
 app.preparation_resource_link, app.member_resource_state from public, anon, authenticated, offerlab_identity_sync, offerlab_auth_function_owner;
grant select on app.content_category, app.content_tag, app.preparation_resource, app.preparation_resource_tag,
 app.preparation_resource_stage, app.preparation_resource_opportunity_type, app.preparation_resource_relation,
 app.preparation_resource_link to offerlab_app;
grant insert,update on app.content_category,app.content_tag,app.preparation_resource to offerlab_app;
grant insert,update,delete on app.preparation_resource_tag,app.preparation_resource_stage,
 app.preparation_resource_opportunity_type,app.preparation_resource_relation,app.preparation_resource_link to offerlab_app;
grant select,insert,update on app.member_resource_state to offerlab_app;

insert into app.content_category(slug,name,description) values
 ('applications','Applications','Planning and written application preparation.'),
 ('interviews','Interviews','Interview preparation and practice.'),
 ('online-assessments','Online assessments','Online test and assessment preparation.'),
 ('assessment-centres','Assessment centres','Assessment-centre exercises and logistics.'),
 ('professional-communication','Professional communication','Clear and professional communication.'),
 ('career-planning','Career planning','Planning and decision-making resources.');
insert into app.content_tag(slug,name,normalized_name) values
 ('planning','Planning','planning'),('practice','Practice','practice'),('checklist','Checklist','checklist'),('examples','Examples','examples');

insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,publication_state,markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at)
select v.resource_key,v.slug,v.title,v.summary,v.resource_type,v.access_level,'published',v.body,c.id,v.minutes,now(),now()
from (values
 ('application_planning_checklist','application-planning-checklist','Application planning checklist','Turn an application deadline into a practical preparation plan.','checklist','public','## Before you begin\n\nUse this starter checklist to identify the deadline, required materials and review time.\n\n- Record the deadline\n- List each required item\n- Reserve a final review slot',10,'applications'),
 ('video_interview_preparation','video-interview-preparation','Video interview preparation','Prepare concise answers and practise delivering them on camera.','guide','member','## Prepare with purpose\n\nChoose evidence-based examples, practise under realistic time limits and review one improvement at a time.\n\n> Starter content: editorial review is required before production launch.',15,'interviews'),
 ('motivation_question_preparation','motivation-question-preparation','Motivation question preparation','Build a specific, evidence-based answer to why this role and organisation.','exercise','member','## Build your answer\n\nConnect what interests you to evidence from the role and organisation. Avoid generic claims.',15,'interviews'),
 ('teamwork_example_preparation','teamwork-example-preparation','Teamwork example preparation','Structure a clear example showing your contribution to a team outcome.','exercise','member','## Select an example\n\nDescribe the situation briefly, make your individual contribution clear and reflect on the outcome.',15,'interviews'),
 ('recording_checklist','recording-checklist','Recording environment checklist','Check the camera, audio, lighting and connection before a recorded interview.','checklist','public','## Technical checks\n\n- Test camera and microphone\n- Check lighting and background\n- Close distractions\n- Confirm a reliable connection',8,'interviews'),
 ('online_test_preparation','online-test-preparation','Online test preparation','Practise the expected test format and prepare a reliable environment.','guide','member','## Practise deliberately\n\nConfirm the format, complete timed practice and review the questions you found difficult.',20,'online-assessments'),
 ('assessment_centre_group_exercise','assessment-centre-group-exercise','Assessment centre group exercise','Practise contributing clearly and constructively in a group exercise.','guide','member','## Effective contribution\n\nListen actively, build on useful points, keep the group aware of time and help it reach a reasoned conclusion.',20,'assessment-centres'),
 ('final_interview_preparation','final-interview-preparation','Final interview preparation','Consolidate your evidence, motivation and questions for a final interview.','guide','member','## Final preparation\n\nReview your strongest evidence, refresh your research and prepare thoughtful questions.',25,'interviews')
) as v(resource_key,slug,title,summary,resource_type,access_level,body,minutes,category_slug)
join app.content_category c on c.slug=v.category_slug;

insert into app.preparation_resource_stage(resource_id,stage)
select r.id,s.stage from app.preparation_resource r cross join lateral (values
 (case when r.resource_key='application_planning_checklist' then 'preparing'
       when r.resource_key in ('video_interview_preparation','motivation_question_preparation','teamwork_example_preparation','recording_checklist') then 'video_interview'
       when r.resource_key='online_test_preparation' then 'online_assessment'
       when r.resource_key='assessment_centre_group_exercise' then 'assessment_centre'
       else 'interview' end)
) s(stage);

comment on table app.preparation_resource is 'Canonical OfferLab standalone library resource and deterministic recommendation target. Seed bodies are starter content requiring editorial review.';
comment on table app.member_resource_state is 'Owner-private independent save and completion state for standalone resources.';
commit;
