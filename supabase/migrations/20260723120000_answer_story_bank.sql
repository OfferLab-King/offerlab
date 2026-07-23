begin;

create table app.competency (
  id uuid primary key default gen_random_uuid(), stable_key text not null unique, label text not null,
  position integer not null unique, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint competency_key_check check(stable_key ~ '^[a-z][a-z0-9_]{0,79}$')
);

insert into app.competency(stable_key,label,position) values
('teamwork','Teamwork',1),('communication','Communication',2),('leadership','Leadership',3),
('problem_solving','Problem solving',4),('adaptability','Adaptability',5),('resilience','Resilience',6),
('initiative','Initiative',7),('organisation','Organisation and prioritisation',8),
('commercial_awareness','Commercial awareness',9),('conflict_resolution','Conflict and disagreement',10);

create table app.member_story (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references app."user"(id) on delete restrict,
  title text not null, experience_type text not null, situation text not null default '', task text not null default '',
  actions text not null default '', reasoning text not null default '', result text not null default '', reflection text not null default '',
  summary text, ready_at timestamptz, archived_at timestamptz, relation_revision integer not null default 0,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint member_story_owner_id_unique unique(owner_user_id,id),
  constraint member_story_title_check check(title=btrim(title) and char_length(title) between 1 and 160),
  constraint member_story_experience_check check(experience_type in ('education','employment','internship','volunteering','society','personal_project','entrepreneurship','caring_responsibility','other')),
  constraint member_story_lengths_check check(char_length(situation)<=3000 and char_length(task)<=3000 and char_length(actions)<=6000 and char_length(reasoning)<=4000 and char_length(result)<=4000 and char_length(reflection)<=4000 and (summary is null or char_length(summary)<=1000)),
  constraint member_story_version_check check(version>0 and relation_revision>=0)
);

create table app.member_story_competency (
  owner_user_id uuid not null, story_id uuid not null, competency_id uuid not null references app.competency(id) on delete restrict,
  created_at timestamptz not null default now(), primary key(story_id,competency_id),
  constraint member_story_competency_owner_fk foreign key(owner_user_id,story_id) references app.member_story(owner_user_id,id) on delete cascade
);

create table app.interview_question (
  id uuid primary key default gen_random_uuid(), stable_key text not null unique, question_family text not null,
  prompt text not null, guidance text not null default '', position integer not null unique, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint interview_question_key_check check(stable_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  constraint interview_question_family_check check(question_family in ('personal_introduction','motivation_and_fit','competency_and_behavioural','self_awareness','commercial_awareness','role_specific','technical','situational','questions_for_interviewer')),
  constraint interview_question_text_check check(prompt=btrim(prompt) and char_length(prompt) between 1 and 1000 and char_length(guidance)<=1000)
);

create table app.interview_question_stage (
  question_id uuid not null references app.interview_question(id) on delete cascade, recruitment_stage text not null,
  primary key(question_id,recruitment_stage),
  constraint interview_question_stage_check check(recruitment_stage in ('preparing','applied','online_assessment','video_interview','interview','assessment_centre','offer','rejected','withdrawn'))
);

create table app.member_answer (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references app."user"(id) on delete restrict,
  question_id uuid references app.interview_question(id) on delete restrict, custom_question text, question_family text not null,
  title text not null, key_points text not null default '', draft_answer text not null default '',
  application_id uuid, recruitment_stage text, ready_at timestamptz, archived_at timestamptz,
  relation_revision integer not null default 0, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint member_answer_owner_id_unique unique(owner_user_id,id),
  constraint member_answer_application_fk foreign key(owner_user_id,application_id) references app.application(owner_user_id,id) on delete restrict,
  constraint member_answer_question_source_check check((question_id is not null)::int+(custom_question is not null)::int=1),
  constraint member_answer_custom_check check(custom_question is null or (custom_question=btrim(custom_question) and char_length(custom_question) between 1 and 1000)),
  constraint member_answer_family_check check(question_family in ('personal_introduction','motivation_and_fit','competency_and_behavioural','self_awareness','commercial_awareness','role_specific','technical','situational','questions_for_interviewer')),
  constraint member_answer_stage_check check(recruitment_stage is null or recruitment_stage in ('preparing','applied','online_assessment','video_interview','interview','assessment_centre','offer','rejected','withdrawn')),
  constraint member_answer_lengths_check check(title=btrim(title) and char_length(title) between 1 and 160 and char_length(key_points)<=4000 and char_length(draft_answer)<=12000),
  constraint member_answer_version_check check(version>0 and relation_revision>=0)
);

create table app.member_answer_story (
  owner_user_id uuid not null, answer_id uuid not null, story_id uuid not null, position integer not null,
  created_at timestamptz not null default now(), primary key(answer_id,story_id), unique(answer_id,position),
  constraint member_answer_story_answer_fk foreign key(owner_user_id,answer_id) references app.member_answer(owner_user_id,id) on delete cascade,
  constraint member_answer_story_story_fk foreign key(owner_user_id,story_id) references app.member_story(owner_user_id,id) on delete restrict,
  constraint member_answer_story_position_check check(position>0)
);

create function app.control_answer_bank_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then new.version:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new; end if;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from to_jsonb(old)-'version'-'created_at'-'updated_at'
    then new.version:=old.version; new.updated_at:=old.updated_at;
    else new.version:=old.version+1; new.updated_at:=clock_timestamp();
  end if; return new;
end $$;
create trigger member_story_control before insert or update on app.member_story for each row execute function app.control_answer_bank_mutation();
create trigger member_answer_control before insert or update on app.member_answer for each row execute function app.control_answer_bank_mutation();

create index member_story_owner_active_idx on app.member_story(owner_user_id,updated_at desc) where archived_at is null;
create index member_answer_owner_active_idx on app.member_answer(owner_user_id,updated_at desc) where archived_at is null;
create index member_answer_application_idx on app.member_answer(owner_user_id,application_id) where archived_at is null and application_id is not null;

alter table app.member_story enable row level security; alter table app.member_story force row level security;
alter table app.member_story_competency enable row level security; alter table app.member_story_competency force row level security;
alter table app.member_answer enable row level security; alter table app.member_answer force row level security;
alter table app.member_answer_story enable row level security; alter table app.member_answer_story force row level security;

create policy member_story_own on app.member_story for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy member_story_competency_own on app.member_story_competency for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy member_answer_own on app.member_answer for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy member_answer_story_own on app.member_answer_story for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy audit_event_insert_answer_bank on app.audit_event for insert to offerlab_app with check(
 actor_user_id=app.current_user_id() and metadata='{}'::jsonb and
 ((entity_type='member_story' and action in ('story.created','story.updated','story.archived','story.restored','story.marked_ready','story.marked_draft') and exists(select 1 from app.member_story s where s.id=entity_id and s.owner_user_id=app.current_user_id())) or
  (entity_type='member_answer' and action in ('answer.created','answer.updated','answer.archived','answer.restored','answer.marked_ready','answer.marked_draft') and exists(select 1 from app.member_answer a where a.id=entity_id and a.owner_user_id=app.current_user_id())))
);

grant select on app.competency,app.interview_question,app.interview_question_stage to offerlab_app;
grant select,insert,update on app.member_story,app.member_story_competency,app.member_answer,app.member_answer_story to offerlab_app;
grant delete on app.member_story_competency,app.member_answer_story to offerlab_app;
revoke all on app.competency,app.interview_question,app.interview_question_stage,app.member_story,app.member_story_competency,app.member_answer,app.member_answer_story from public,anon,authenticated,offerlab_identity_sync;
revoke all on function app.control_answer_bank_mutation() from public,anon,authenticated,offerlab_identity_sync;
grant execute on function app.control_answer_bank_mutation() to offerlab_app;

comment on table app.member_story is 'Private owner-scoped reusable evidence stories.';
comment on table app.member_answer is 'Private owner-scoped interview answer drafts.';
commit;
