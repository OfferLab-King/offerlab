begin;

alter table app.recruitment_intelligence_report
  add column company_name text,
  add column role_title text,
  add column location text,
  add column preparation_advice text,
  add column outcome text,
  add column source_kind text not null default 'member',
  add column confidentiality_confirmed_at timestamptz,
  add column slug text;

update app.recruitment_intelligence_report
set company_name='Employer not specified',
    role_title='Graduate opportunity',
    preparation_advice=reflection,
    confidentiality_confirmed_at=created_at,
    slug='candidate-experience-' || left(replace(id::text,'-',''),12),
    moderation_state='pending',
    moderation_confidence=null,
    moderated_by_user_id=null,
    moderated_at=null
where company_name is null;

alter table app.recruitment_intelligence_report
  alter column company_name set not null,
  alter column role_title set not null,
  alter column preparation_advice set not null,
  alter column confidentiality_confirmed_at set not null,
  alter column slug set not null,
  alter column source_kind drop default,
  add constraint recruitment_intelligence_slug_unique unique(slug),
  add constraint recruitment_intelligence_slug_check
    check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug)<=180),
  add constraint recruitment_intelligence_provenance_check
    check(source_kind in ('member','coach_curated')),
  add constraint recruitment_intelligence_library_text_check check(
    company_name=btrim(company_name) and char_length(company_name) between 1 and 160 and
    role_title=btrim(role_title) and char_length(role_title) between 1 and 160 and
    (location is null or (location=btrim(location) and char_length(location) between 1 and 120)) and
    preparation_advice=btrim(preparation_advice) and char_length(preparation_advice) between 1 and 1500 and
    (outcome is null or (outcome=btrim(outcome) and char_length(outcome) between 1 and 500))
  );

alter table app.recruitment_intelligence_report
  add column search_document tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(company_name,'') || ' ' || coalesce(role_title,'') || ' ' ||
      coalesce(format_summary,'') || ' ' || coalesce(themes,'')
    )
  ) stored;

create index recruitment_intelligence_search_idx
  on app.recruitment_intelligence_report using gin(search_document)
  where moderation_state='published';
create index recruitment_intelligence_company_cycle_idx
  on app.recruitment_intelligence_report(lower(company_name),recruitment_cycle,approximate_date desc)
  where moderation_state='published';

drop policy intelligence_member_submit on app.recruitment_intelligence_report;
create policy intelligence_member_submit on app.recruitment_intelligence_report
  for insert to offerlab_app with check(
    owner_user_id=app.current_user_id() and source_kind='member' and
    confidentiality_confirmed_at is not null and moderation_state='pending' and
    moderation_confidence is null and moderated_by_user_id is null and moderated_at is null
  );
create policy intelligence_admin_create on app.recruitment_intelligence_report
  for insert to offerlab_app with check(
    owner_user_id=app.current_user_id() and source_kind='coach_curated' and
    confidentiality_confirmed_at is not null and moderation_state='pending' and
    moderation_confidence is null and moderated_by_user_id is null and moderated_at is null and
    exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator')
  );

drop policy audit_event_insert_phase_one on app.audit_event;
create policy audit_event_insert_phase_one on app.audit_event for insert to offerlab_app with check(
  actor_user_id=app.current_user_id() and metadata='{}'::jsonb and (
    (entity_type='recruitment_intelligence_report' and
      action in ('intelligence.submitted','intelligence.updated','intelligence.published','intelligence.rejected') and
      exists(select 1 from app.recruitment_intelligence_report r where r.id=entity_id)) or
    (entity_type='service_request' and
      action in ('service.requested','service.cancelled','service.confirmed','service.completed') and
      exists(select 1 from app.service_request r where r.id=entity_id)) or
    (entity_type='service_offering' and action='service.availability_updated' and
      exists(select 1 from app.service_offering o where o.id=entity_id) and
      exists(select 1 from app."user" u where u.id=app.current_user_id() and u.role='administrator'))
  )
);

comment on column app.recruitment_intelligence_report.source_kind is
  'Visible provenance: member submission or coach-curated from authorised anonymised feedback.';
comment on column app.recruitment_intelligence_report.confidentiality_confirmed_at is
  'Required confirmation that the report excludes restricted material and identifying information.';

commit;
