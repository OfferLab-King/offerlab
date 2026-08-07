begin;

alter table app.answer_coach_review
  add column model_requested boolean not null default false,
  add column provider_notice_version text,
  add column input_tokens integer check(input_tokens is null or input_tokens>=0),
  add column output_tokens integer check(output_tokens is null or output_tokens>=0),
  add column latency_ms integer check(latency_ms is null or latency_ms>=0),
  add constraint answer_coach_review_notice_check check(
    (model_requested and provider_notice_version is not null)
    or (not model_requested and provider_notice_version is null)
  );

comment on column app.answer_coach_review.provider_notice_version is
  'Version of the member-facing model data notice accepted for a requested model review.';
comment on column app.answer_coach_review.input_tokens is
  'Provider operational metadata only; prompts and outputs are never logged.';

commit;
