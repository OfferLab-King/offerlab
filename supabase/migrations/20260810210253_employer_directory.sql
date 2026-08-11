begin;

alter table app.company
  add column description text;

alter table app.company
  add constraint company_description_check check (
    description is null or (
      description = btrim(description) and char_length(description) between 1 and 600
    )
  );

grant select (description) on app.company to offerlab_app;

comment on column app.company.description is
  'Optional short original employer description for the public employer directory; empty until an administrator or seed supplies one.';

commit;
