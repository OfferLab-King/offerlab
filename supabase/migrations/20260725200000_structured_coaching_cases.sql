begin;

create table app.coaching_case_detail (
  resource_id uuid primary key references app.preparation_resource(id) on delete cascade,
  question_id uuid references app.interview_question(id) on delete restrict,
  question_text text not null check(question_text=btrim(question_text) and char_length(question_text) between 1 and 1000),
  original_answer text not null check(original_answer=btrim(original_answer) and char_length(original_answer) between 1 and 8000),
  improved_answer text not null check(improved_answer=btrim(improved_answer) and char_length(improved_answer) between 1 and 8000),
  changes jsonb not null check(jsonb_typeof(changes)='array' and jsonb_array_length(changes) between 1 and 20),
  key_weaknesses text[] not null check(cardinality(key_weaknesses) between 1 and 6),
  why_stronger text not null check(why_stronger=btrim(why_stronger) and char_length(why_stronger) between 1 and 2000),
  practice_prompt text not null check(practice_prompt=btrim(practice_prompt) and char_length(practice_prompt) between 1 and 1000),
  source_kind text not null check(source_kind in ('synthetic','anonymised_approved')),
  anonymisation_confirmed_at timestamptz,
  anonymisation_confirmed_by_user_id uuid references app."user"(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint coaching_case_source_confirmation_check check(
    (source_kind='synthetic' and anonymisation_confirmed_at is null and anonymisation_confirmed_by_user_id is null) or
    (source_kind='anonymised_approved' and anonymisation_confirmed_at is not null and anonymisation_confirmed_by_user_id is not null)
  )
);

alter table app.coaching_case_detail enable row level security;
alter table app.coaching_case_detail force row level security;
create policy coaching_case_detail_read on app.coaching_case_detail for select to offerlab_app using(
  exists(select 1 from app.preparation_resource r where r.id=resource_id and r.resource_type='coaching_case' and r.publication_state='published')
);
create policy coaching_case_detail_admin_write on app.coaching_case_detail for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  with check(exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'));
grant select,insert,update,delete on app.coaching_case_detail to offerlab_app;
revoke all on app.coaching_case_detail from public,anon,authenticated,offerlab_identity_sync,offerlab_auth_function_owner;

insert into app.preparation_resource(
  resource_key,slug,title,short_description,resource_type,access_level,publication_state,
  markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at
)
select
  'annotated_teamwork_answer_case','annotated-teamwork-answer-case',
  'Before and after: making teamwork evidence specific',
  'Inspect a synthetic teamwork answer with sentence-level coach comments and visible edits.',
  'coaching_case','member','published',
  'This synthetic teaching case shows why generic team language is weak and how a revision can make individual action, evidence and reflection visible.',
  c.id,10,clock_timestamp(),clock_timestamp()
from app.content_category c where c.slug='interviews'
on conflict(resource_key) do nothing;

insert into app.preparation_resource_stage(resource_id,stage)
select id,'interview' from app.preparation_resource where resource_key='annotated_teamwork_answer_case'
on conflict do nothing;

insert into app.preparation_resource_tag(resource_id,tag_id)
select r.id,t.id from app.preparation_resource r cross join app.content_tag t
where r.resource_key='annotated_teamwork_answer_case' and t.slug in ('examples','practice')
on conflict do nothing;

insert into app.coaching_case_detail(
  resource_id,question_id,question_text,original_answer,improved_answer,changes,key_weaknesses,
  why_stronger,practice_prompt,source_kind
)
select r.id,q.id,q.prompt,
  'During a university consulting project, we had to recommend how a charity should attract more volunteers. We all worked on the research and I helped with the presentation. The project went well and the charity liked our ideas. I learned a lot about teamwork.',
  'During a university consulting project, we had to recommend how a charity should attract more volunteers. I interviewed six current volunteers, grouped their reasons for joining and used those themes to propose a clearer sign-up message. The charity adopted the message for its next campaign and reported more enquiries in the following fortnight. I learned that teamwork is strongest when I make my own contribution explicit while showing how it supports the shared outcome.',
  '[
    {"id":"individual_action","category":"Evidence","start":106,"end":171,"replacement":"I interviewed six current volunteers, grouped their reasons for joining and used those themes to propose a clearer sign-up message.","heading":"Replace vague team language","explanation":"The original says what the group did but not what this candidate contributed. The revision names first-person actions and keeps every detail inside the synthetic scenario."},
    {"id":"result_evidence","category":"Evidence","start":172,"end":226,"replacement":"The charity adopted the message for its next campaign and reported more enquiries in the following fortnight.","heading":"Show what changed","explanation":"“Went well” is impossible to assess. The revision gives a concrete, proportionate outcome without turning the answer into an unsupported percentage claim."},
    {"id":"specific_reflection","category":"Reflection","start":227,"end":258,"replacement":"I learned that teamwork is strongest when I make my own contribution explicit while showing how it supports the shared outcome.","heading":"Make the learning useful","explanation":"The original reflection is generic. The revision states a judgement the candidate could apply in another team."}
  ]'::jsonb,
  array['Describing only what “we” did','Using an outcome such as “went well” without evidence','Ending with a generic statement about learning'],
  'The revision keeps the same experience but makes the candidate’s actions, the outcome and the transferable learning inspectable. It is stronger because the evidence supports the claim; it is not stronger merely because it is longer.',
  'Choose one teamwork example from your own experience. Underline every sentence that shows your personal action, then check that the result and reflection are as specific as the action.',
  'synthetic'
from app.preparation_resource r
join app.interview_question q on q.stable_key='teamwork'
where r.resource_key='annotated_teamwork_answer_case'
on conflict(resource_id) do nothing;

comment on table app.coaching_case_detail is 'Structured editorial before/after teaching case. Previous-student material requires explicit anonymised-approved provenance before publication.';
commit;
