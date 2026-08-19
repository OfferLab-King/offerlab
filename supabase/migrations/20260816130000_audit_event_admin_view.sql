begin;

-- Purpose-limited administrator read access to the audit trail.
--
-- The audit_event table is append-only and stores only allow-listed
-- non-sensitive metadata (never notes, tokens, passwords or onboarding
-- answers). Administrators can read the full trail to review who did what and
-- when; ordinary members keep no read access. Inserts remain governed by the
-- existing per-module, action-scoped insert policies.

create policy audit_event_admin_select
  on app.audit_event
  for select
  to offerlab_app
  using (
    exists (
      select 1 from app."user" u
      where u.id = app.current_user_id() and u.role = 'administrator'
    )
  );

grant select on app.audit_event to offerlab_app;

commit;