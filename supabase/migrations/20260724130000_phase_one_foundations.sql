begin;

alter table app.preparation_resource drop constraint preparation_resource_type_check;
alter table app.preparation_resource add constraint preparation_resource_type_check
  check (resource_type in ('guide','checklist','template','video','exercise','article','coaching_case'));

create table app.recruitment_intelligence_report (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  recruitment_cycle text not null,
  approximate_date date not null,
  recruitment_stage text not null,
  opportunity_type text,
  industry text,
  format_summary text not null,
  themes text not null,
  assessed_skills text[] not null default '{}',
  reflection text not null,
  moderation_state text not null default 'pending',
  moderation_confidence text,
  moderated_by_user_id uuid references app."user"(id) on delete restrict,
  moderated_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruitment_intelligence_owner_id_unique unique(owner_user_id,id),
  constraint recruitment_intelligence_cycle_check check(recruitment_cycle ~ '^[0-9]{4}/[0-9]{2}$'),
  constraint recruitment_intelligence_stage_check check(recruitment_stage in ('preparing','applied','online_assessment','video_interview','interview','assessment_centre','offer','rejected','withdrawn')),
  constraint recruitment_intelligence_opportunity_check check(opportunity_type is null or opportunity_type in ('graduate_scheme','internship','placement','entry_level_role')),
  constraint recruitment_intelligence_industry_check check(industry is null or industry in ('consulting','accounting_professional_services','financial_services','technology','public_sector','consumer_retail','general_corporate','other')),
  constraint recruitment_intelligence_text_check check(
    format_summary=btrim(format_summary) and char_length(format_summary) between 1 and 200 and
    themes=btrim(themes) and char_length(themes) between 1 and 1000 and
    reflection=btrim(reflection) and char_length(reflection) between 1 and 1500 and
    cardinality(assessed_skills) between 1 and 10
  ),
  constraint recruitment_intelligence_state_check check(moderation_state in ('pending','published','rejected')),
  constraint recruitment_intelligence_confidence_check check(moderation_confidence is null or moderation_confidence in ('low','medium','high')),
  constraint recruitment_intelligence_lifecycle_check check(
    (moderation_state='pending' and moderation_confidence is null and moderated_by_user_id is null and moderated_at is null) or
    (moderation_state in ('published','rejected') and moderation_confidence is not null and moderated_by_user_id is not null and moderated_at is not null)
  ),
  constraint recruitment_intelligence_version_check check(version>0)
);

create table app.service_offering (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  offering_type text not null,
  title text not null,
  summary text not null,
  delivery_mode text not null,
  availability text not null default 'interest',
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  turnaround_days integer,
  position integer not null unique,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_offering_key_check check(stable_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  constraint service_offering_type_check check(offering_type in ('group_mock','answer_review','mock_interview','cv_review','written_exercise_review')),
  constraint service_offering_delivery_check check(delivery_mode in ('online','asynchronous')),
  constraint service_offering_availability_check check(availability in ('interest','scheduled','open','paused')),
  constraint service_offering_text_check check(title=btrim(title) and char_length(title) between 1 and 160 and summary=btrim(summary) and char_length(summary) between 1 and 500),
  constraint service_offering_schedule_check check(
    (availability='scheduled' and starts_at is not null and ends_at>starts_at and capacity between 1 and 100) or
    (availability<>'scheduled' and starts_at is null and ends_at is null and capacity is null)
  ),
  constraint service_offering_turnaround_check check(turnaround_days is null or turnaround_days between 1 and 30),
  constraint service_offering_version_check check(version>0 and position>0)
);

create table app.service_request (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  offering_id uuid not null references app.service_offering(id) on delete restrict,
  status text not null default 'requested',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_owner_id_unique unique(owner_user_id,id),
  constraint service_request_identity_unique unique(owner_user_id,offering_id),
  constraint service_request_status_check check(status in ('requested','confirmed','completed','cancelled')),
  constraint service_request_version_check check(version>0)
);

create function app.control_phase_one_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' then new.version:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new; end if;
  new.created_at:=old.created_at;
  if to_jsonb(new)-'version'-'created_at'-'updated_at' is not distinct from to_jsonb(old)-'version'-'created_at'-'updated_at'
    then new.version:=old.version; new.updated_at:=old.updated_at;
    else new.version:=old.version+1; new.updated_at:=clock_timestamp();
  end if;
  return new;
end $$;

create trigger recruitment_intelligence_control before insert or update on app.recruitment_intelligence_report for each row execute function app.control_phase_one_mutation();
create trigger service_offering_control before insert or update on app.service_offering for each row execute function app.control_phase_one_mutation();
create trigger service_request_control before insert or update on app.service_request for each row execute function app.control_phase_one_mutation();

create index recruitment_intelligence_published_idx on app.recruitment_intelligence_report(recruitment_stage,approximate_date desc,id) where moderation_state='published';
create index recruitment_intelligence_owner_idx on app.recruitment_intelligence_report(owner_user_id,created_at desc);
create index service_request_admin_idx on app.service_request(status,created_at,id);

alter table app.recruitment_intelligence_report enable row level security;
alter table app.recruitment_intelligence_report force row level security;
alter table app.service_offering enable row level security;
alter table app.service_offering force row level security;
alter table app.service_request enable row level security;
alter table app.service_request force row level security;

create policy intelligence_read on app.recruitment_intelligence_report for select to offerlab_app using(
  owner_user_id=app.current_user_id() or moderation_state='published' or
  exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy intelligence_member_submit on app.recruitment_intelligence_report for insert to offerlab_app with check(
  owner_user_id=app.current_user_id() and moderation_state='pending' and moderation_confidence is null and moderated_by_user_id is null and moderated_at is null
);
create policy intelligence_admin_moderate on app.recruitment_intelligence_report for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy service_offering_read on app.service_offering for select to offerlab_app using(
  availability<>'paused' or exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy service_offering_admin_write on app.service_offering for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
create policy service_request_read on app.service_request for select to offerlab_app using(
  owner_user_id=app.current_user_id() or exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
);
create policy service_request_member_submit on app.service_request for insert to offerlab_app with check(
  owner_user_id=app.current_user_id() and status='requested' and
  exists(select 1 from app.service_offering o where o.id=offering_id and o.availability<>'paused')
);
create policy service_request_member_cancel on app.service_request for update to offerlab_app
  using(owner_user_id=app.current_user_id() and status in ('requested','confirmed','cancelled'))
  with check(owner_user_id=app.current_user_id() and status in ('requested','cancelled'));
create policy service_request_admin_update on app.service_request for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));

create policy audit_event_insert_phase_one on app.audit_event for insert to offerlab_app with check(
  actor_user_id=app.current_user_id() and metadata='{}'::jsonb and (
    (entity_type='recruitment_intelligence_report' and action in ('intelligence.submitted','intelligence.published','intelligence.rejected') and exists(select 1 from app.recruitment_intelligence_report r where r.id=entity_id)) or
    (entity_type='service_request' and action in ('service.requested','service.cancelled','service.confirmed','service.completed') and exists(select 1 from app.service_request r where r.id=entity_id)) or
    (entity_type='service_offering' and action='service.availability_updated' and exists(select 1 from app.service_offering o where o.id=entity_id) and exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  )
);

revoke all on app.recruitment_intelligence_report,app.service_offering,app.service_request from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
grant select,insert,update on app.recruitment_intelligence_report to offerlab_app;
grant select,update on app.service_offering to offerlab_app;
grant select,insert,update on app.service_request to offerlab_app;
revoke all on function app.control_phase_one_mutation() from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;
grant execute on function app.control_phase_one_mutation() to offerlab_app;

insert into app.service_offering(stable_key,offering_type,title,summary,delivery_mode,availability,turnaround_days,position) values
('group_mock_pilot','group_mock','Group Mock pilot','Register interest in a facilitated, structured group-exercise practice session.','online','interest',null,1),
('answer_review_pilot','answer_review','Interview answer review','Request a manually reviewed, evidence-grounded critique of one interview answer.','asynchronous','interest',5,2),
('mock_interview_pilot','mock_interview','Personal mock interview','Register interest in a focused one-to-one mock interview and review.','online','interest',null,3);

insert into app.interview_question(stable_key,question_family,prompt,guidance,position)
select stable_key,family,prompt,'Plan a concise, specific answer in your own words.',position
from (values
  ('tell_me_about_yourself','personal_introduction','Tell me about yourself.',1),
  ('why_organisation','motivation_and_fit','Why do you want to work for this organisation?',2),
  ('why_role','motivation_and_fit','Why are you interested in this role?',3),
  ('why_industry','motivation_and_fit','Why are you interested in this industry?',4),
  ('why_select_you','motivation_and_fit','Why should we select you?',5),
  ('career_goals','motivation_and_fit','What are your longer-term career goals?',6),
  ('teamwork','competency_and_behavioural','Tell me about a time you worked effectively in a team.',7),
  ('leadership','competency_and_behavioural','Tell me about a time you showed leadership.',8),
  ('problem_solving','competency_and_behavioural','Tell me about a difficult problem you solved.',9),
  ('conflict','competency_and_behavioural','Tell me about a disagreement or conflict.',10),
  ('setback','competency_and_behavioural','Tell me about a setback or failure.',11),
  ('resilience','competency_and_behavioural','Tell me about a time you showed resilience.',12),
  ('adapted','competency_and_behavioural','Tell me about a time you adapted to change.',13),
  ('initiative','competency_and_behavioural','Tell me about a time you used initiative.',14),
  ('prioritised','competency_and_behavioural','Tell me about a time you prioritised competing tasks.',15),
  ('strengths','self_awareness','What are your main strengths?',16),
  ('development_area','self_awareness','What is one development area you are working on?',17),
  ('feedback','self_awareness','Tell me about feedback you received and acted on.',18),
  ('recent_development','commercial_awareness','Discuss a recent development relevant to this organisation or industry.',19),
  ('questions_for_us','questions_for_interviewer','What questions would you like to ask us?',20)
) questions(stable_key,family,prompt,position)
on conflict(stable_key) do nothing;

insert into app.interview_question_stage(question_id,recruitment_stage)
select q.id,stage.stage
from app.interview_question q
cross join (values ('video_interview'),('interview')) stage(stage)
where q.stable_key in (
  'tell_me_about_yourself','why_organisation','why_role','why_industry','why_select_you','career_goals',
  'teamwork','leadership','problem_solving','conflict','setback','resilience','adapted','initiative','feedback','recent_development'
)
on conflict do nothing;

insert into app.interview_question_stage(question_id,recruitment_stage)
select q.id,'assessment_centre' from app.interview_question q
where q.stable_key in ('teamwork','leadership','conflict','prioritised')
on conflict do nothing;

insert into app.preparation_resource(
  resource_key,slug,title,short_description,resource_type,access_level,publication_state,
  markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at
)
select
  'demonstration_group_case','demonstration-group-exercise-case',
  'Demonstration case: prioritising under pressure',
  'See how a candidate could structure a group-exercise recommendation, with the trade-offs and coaching notes made visible.',
  'coaching_case','member','published',
  '## About this case\n\nThis is a synthetic teaching example, not a report of a real candidate or employer process. Use the reasoning pattern; do not copy the wording.\n\n## The scenario\n\nA graduate group must recommend which of three community projects should receive limited funding. Each option has a different reach, delivery risk and evidence base.\n\n## A workable approach\n\nThe candidate proposes three decision criteria: likely impact, confidence in delivery and fit with the stated objective. They invite the group to test every option against the same criteria, then keep time visible.\n\n> **Coach annotation — useful move:** The structure helps the group compare options without pretending one metric captures everything.\n\n## The key trade-off\n\nThe highest-reach project also has the weakest delivery evidence. Rather than dismissing it, the candidate suggests a staged award with a milestone before the remaining funds are released.\n\n> **Coach annotation — why it works:** The recommendation responds to uncertainty instead of hiding it. It connects the risk to a practical condition.\n\n## What could be stronger\n\nThe candidate speaks for too long when first introducing the criteria. A sharper version would name the three criteria, ask for additions and move immediately to the first option.\n\n## Questions for your own practice\n\n- How would you bring in someone who has not spoken?\n- What evidence would change your recommendation?\n- How would you summarise disagreement without erasing it?',
  c.id,12,now(),now()
from app.content_category c where c.slug='assessment-centres';

insert into app.preparation_resource_stage(resource_id,stage)
select id,'assessment_centre' from app.preparation_resource where resource_key='demonstration_group_case';

insert into app.preparation_resource_tag(resource_id,tag_id)
select r.id,t.id from app.preparation_resource r cross join app.content_tag t
where r.resource_key='demonstration_group_case' and t.slug in ('examples','practice');

comment on table app.recruitment_intelligence_report is 'Cycle-dated, moderated candidate intelligence. Submissions must exclude employer-confidential content and exact private questions.';
comment on table app.service_request is 'Privacy-minimal requests for manually operated practice and feedback pilots; no payment, matching or member free text.';

commit;
