begin;

create table app.learning_path (
  id uuid primary key default gen_random_uuid(), path_key text not null unique, slug text not null unique,
  title text not null default '', short_description text not null default '', introduction text not null default '',
  structure_fingerprint text not null default '',
  publication_state text not null default 'draft', primary_category_id uuid references app.content_category(id) on delete restrict,
  first_published_at timestamptz, published_at timestamptz, archived_at timestamptz,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint learning_path_key_check check(path_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  constraint learning_path_slug_check check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
  constraint learning_path_title_check check(length(title)<=160),
  constraint learning_path_description_check check(length(short_description)<=500),
  constraint learning_path_introduction_check check(length(introduction)<=50000),
  constraint learning_path_structure_fingerprint_check check(structure_fingerprint='' or structure_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint learning_path_state_check check(publication_state in ('draft','published','archived')),
  constraint learning_path_version_check check(version>0),
  constraint learning_path_lifecycle_check check(
    (publication_state='draft' and published_at is null and archived_at is null) or
    (publication_state='published' and published_at is not null and archived_at is null) or
    (publication_state='archived' and published_at is null and archived_at is not null))
);
create index learning_path_catalogue_idx on app.learning_path(publication_state,primary_category_id,title,id);
create table app.learning_path_section (
  id uuid primary key default gen_random_uuid(), learning_path_id uuid not null references app.learning_path(id) on delete cascade,
  heading text not null, short_description text not null default '', position integer not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(learning_path_id,position), unique(learning_path_id,id), constraint learning_path_section_heading_check check(length(heading)<=120),
  constraint learning_path_section_description_check check(length(short_description)<=500),
  constraint learning_path_section_position_check check(position between 1 and 30)
);
create table app.learning_path_item (
  id uuid primary key default gen_random_uuid(), learning_path_id uuid not null references app.learning_path(id) on delete cascade,
  section_id uuid not null,
  preparation_resource_id uuid not null references app.preparation_resource(id) on delete restrict,
  position integer not null, context_note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(section_id,position), constraint learning_path_item_note_check check(length(context_note)<=500),
  constraint learning_path_item_position_check check(position between 1 and 50),
  foreign key(learning_path_id,section_id) references app.learning_path_section(learning_path_id,id) on delete cascade
);
create unique index learning_path_resource_unique on app.learning_path_item(learning_path_id,preparation_resource_id);
create table app.member_learning_path_state (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references app."user"(id) on delete restrict,
  learning_path_id uuid not null references app.learning_path(id) on delete restrict, started_at timestamptz, stopped_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,learning_path_id),
  constraint member_learning_path_state_time_check check(stopped_at is null or started_at is not null)
);

create trigger learning_path_control before insert or update on app.learning_path for each row execute function app.control_versioned_content_mutation();

alter table app.learning_path enable row level security; alter table app.learning_path force row level security;
alter table app.learning_path_section enable row level security; alter table app.learning_path_section force row level security;
alter table app.learning_path_item enable row level security; alter table app.learning_path_item force row level security;
alter table app.member_learning_path_state enable row level security; alter table app.member_learning_path_state force row level security;
create policy learning_path_read on app.learning_path for select to offerlab_app using(publication_state='published' or exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy learning_path_admin_write on app.learning_path for all to offerlab_app using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy learning_path_section_read on app.learning_path_section for select to offerlab_app using(exists(select 1 from app.learning_path p where p.id=learning_path_id));
create policy learning_path_section_write on app.learning_path_section for all to offerlab_app using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy learning_path_item_read on app.learning_path_item for select to offerlab_app using(exists(select 1 from app.learning_path_section s join app.learning_path p on p.id=s.learning_path_id where s.id=section_id));
create policy learning_path_item_write on app.learning_path_item for all to offerlab_app using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')) with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy member_path_state_own on app.member_learning_path_state for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy audit_event_insert_learning_path on app.audit_event for insert to offerlab_app with check(actor_user_id=app.current_user_id() and entity_type in ('learning_path','member_learning_path_state') and action in ('learning_path.created','learning_path.updated','learning_path.published','learning_path.unpublished','learning_path.archived','learning_path.restored','learning_path.started','learning_path.stopped') and metadata='{}'::jsonb and (entity_type='learning_path' and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator') or entity_type='member_learning_path_state' and exists(select 1 from app.member_learning_path_state s where s.id=entity_id and s.owner_user_id=app.current_user_id())));
revoke all on app.learning_path,app.learning_path_section,app.learning_path_item,app.member_learning_path_state from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
grant select,insert,update on app.learning_path to offerlab_app;
grant select,insert,update,delete on app.learning_path_section,app.learning_path_item to offerlab_app;
grant select,insert,update on app.member_learning_path_state to offerlab_app;

insert into app.learning_path(path_key,slug,title,short_description,introduction,primary_category_id) select v.path_key,v.slug,v.title,v.description,'> Starter path: founder editorial review is required before publication.',c.id from (values
('prepare_video_interview','prepare-for-a-video-interview','Prepare for a Video Interview','A recommended sequence for confident video-interview preparation.','interviews'),
('build_competency_examples','build-strong-competency-examples','Build Strong Competency Examples','Develop clear evidence-based examples for interviews.','interviews'),
('prepare_group_exercise','prepare-for-an-assessment-centre-group-exercise','Prepare for an Assessment-Centre Group Exercise','Build confidence for collaborative assessment-centre exercises.','assessment-centres'),
('prepare_online_assessment','prepare-for-an-online-assessment','Prepare for an Online Assessment','A practical route through online assessment preparation.','online-assessments'),
('prepare_final_interview','prepare-for-a-final-interview','Prepare for a Final Interview','Structure focused preparation for a final interview.','interviews')) v(path_key,slug,title,description,category) join app.content_category c on c.slug=v.category;
with mapping(path_key,heading,resource_key,position) as (values
('prepare_video_interview','Prepare and practise','video_interview_preparation',1),('prepare_video_interview','Prepare and practise','recording_checklist',2),
('build_competency_examples','Build your evidence','teamwork_example_preparation',1),('build_competency_examples','Build your evidence','motivation_question_preparation',2),
('prepare_group_exercise','Practise the exercise','assessment_centre_group_exercise',1),
('prepare_online_assessment','Prepare deliberately','online_test_preparation',1),
('prepare_final_interview','Prepare your approach','final_interview_preparation',1)), sections as (
insert into app.learning_path_section(learning_path_id,heading,position) select distinct p.id,m.heading,1 from mapping m join app.learning_path p on p.path_key=m.path_key returning id,learning_path_id)
insert into app.learning_path_item(learning_path_id,section_id,preparation_resource_id,position) select p.id,s.id,r.id,m.position from mapping m join app.learning_path p on p.path_key=m.path_key join sections s on s.learning_path_id=p.id join app.preparation_resource r on r.resource_key=m.resource_key;
commit;
