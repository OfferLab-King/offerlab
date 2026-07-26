begin;

drop policy intelligence_comment_flag_member_submit
  on app.recruitment_intelligence_comment_flag;
create policy intelligence_comment_flag_member_submit
  on app.recruitment_intelligence_comment_flag
  for insert to offerlab_app with check(
    owner_user_id=app.current_user_id() and resolution is null and
    exists(
      select 1 from app.recruitment_intelligence_comment c
      where c.id=comment_id and c.owner_user_id<>app.current_user_id()
        and c.moderation_state='published'
    )
  );

comment on policy intelligence_comment_flag_member_submit
  on app.recruitment_intelligence_comment_flag is
  'Members may flag a published comment written by another member; administrator resolution remains separate.';

commit;
