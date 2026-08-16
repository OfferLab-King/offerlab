begin;

-- Restrict discussion comment reads to reports the member can actually view.
--
-- The member read policy previously allowed reading published comments on any
-- report regardless of report moderation state. Combined with the application
-- query change, a member can no longer read comments attached to another
-- member's pending or rejected report: published comments are readable only
-- on published reports, a comment author keeps access to their own comments
-- on reports they own or that are published, and administrators keep full
-- moderation access.

drop policy if exists intelligence_comment_read on app.recruitment_intelligence_comment;

create policy intelligence_comment_read
  on app.recruitment_intelligence_comment
  for select
  to offerlab_app
  using (
    exists (
      select 1 from app."user" u
      where u.id = app.current_user_id() and u.role = 'administrator'
    ) or
    (
      moderation_state = 'published' and
      exists (
        select 1 from app.recruitment_intelligence_report r
        where r.id = report_id and r.moderation_state = 'published'
      )
    ) or
    (
      owner_user_id = app.current_user_id() and
      exists (
        select 1 from app.recruitment_intelligence_report r
        where r.id = report_id and (r.moderation_state = 'published' or r.owner_user_id = app.current_user_id())
      )
    )
  );

commit;