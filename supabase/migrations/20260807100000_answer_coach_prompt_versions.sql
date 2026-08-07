alter table app.answer_coach_review
  drop constraint answer_coach_review_prompt_version_check;

alter table app.answer_coach_review
  add constraint answer_coach_review_prompt_version_check
  check (prompt_version between 1 and 100);

comment on column app.answer_coach_review.prompt_version is
  'Version of the validated Answer Coach prompt contract used for this recoverable review.';
