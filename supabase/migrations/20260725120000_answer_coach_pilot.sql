begin;

create table app.answer_coach_review (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  answer_id uuid not null,
  answer_version integer not null check(answer_version>0),
  answer_snapshot text not null check(char_length(answer_snapshot) between 1 and 8000),
  prompt_id text not null default 'answer_coach' check(prompt_id='answer_coach'),
  prompt_version integer not null default 1 check(prompt_version=1),
  provider_id text not null check(provider_id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  provider_mode text not null check(provider_mode in ('local_rubric','model')),
  summary text not null check(char_length(summary) between 1 and 300),
  strengths jsonb not null default '[]'::jsonb check(jsonb_typeof(strengths)='array'),
  follow_up_questions jsonb not null default '[]'::jsonb check(jsonb_typeof(follow_up_questions)='array'),
  unsupported_claims jsonb not null default '[]'::jsonb check(jsonb_typeof(unsupported_claims)='array'),
  created_at timestamptz not null default clock_timestamp(),
  constraint answer_coach_review_answer_fk foreign key(owner_user_id,answer_id) references app.member_answer(owner_user_id,id) on delete restrict,
  unique(owner_user_id,id)
);

create table app.answer_coach_comment (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  review_id uuid not null,
  position integer not null check(position between 1 and 8),
  category text not null check(category in ('Evidence','Reasoning','Relevance','Structure','Reflection')),
  anchor_start integer not null check(anchor_start>=0),
  anchor_end integer not null check(anchor_end>anchor_start),
  anchor_quote text not null check(char_length(anchor_quote) between 1 and 500),
  observation text not null check(char_length(observation) between 1 and 500),
  coaching_question text not null check(char_length(coaching_question) between 1 and 300),
  optional_revision text check(optional_revision is null or char_length(optional_revision) between 1 and 500),
  state text not null default 'open' check(state in ('open','addressed','dismissed')),
  updated_at timestamptz not null default clock_timestamp(),
  constraint answer_coach_comment_review_fk foreign key(owner_user_id,review_id) references app.answer_coach_review(owner_user_id,id) on delete cascade,
  unique(review_id,position)
);

create index answer_coach_review_owner_answer_created_idx on app.answer_coach_review(owner_user_id,answer_id,created_at desc);
create index answer_coach_review_owner_month_idx on app.answer_coach_review(owner_user_id,created_at);
create index answer_coach_comment_review_idx on app.answer_coach_comment(owner_user_id,review_id,position);

alter table app.answer_coach_review enable row level security;
alter table app.answer_coach_review force row level security;
alter table app.answer_coach_comment enable row level security;
alter table app.answer_coach_comment force row level security;
create policy answer_coach_review_own on app.answer_coach_review for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());
create policy answer_coach_comment_own on app.answer_coach_comment for all to offerlab_app using(owner_user_id=app.current_user_id()) with check(owner_user_id=app.current_user_id());

grant select,insert on app.answer_coach_review to offerlab_app;
grant select,insert,update on app.answer_coach_comment to offerlab_app;
revoke all on app.answer_coach_review,app.answer_coach_comment from public,anon,authenticated,offerlab_identity_sync;

comment on table app.answer_coach_review is 'Owner-scoped recoverable Answer Coach review snapshots; never used to mutate member answers.';
comment on table app.answer_coach_comment is 'Anchored coaching comments and member-controlled review state.';
commit;
