begin;

-- Early demonstration content used SQL strings containing literal "\n" text.
-- Repair only the known synthetic seed records so administrator-authored content is untouched.
update app.preparation_resource
set markdown_body = replace(markdown_body, E'\\n', E'\n')
where resource_key in (
  'application_planning_checklist',
  'video_interview_preparation',
  'motivation_question_preparation',
  'teamwork_example_preparation',
  'recording_checklist',
  'online_test_preparation',
  'assessment_centre_group_exercise',
  'final_interview_preparation',
  'demonstration_group_case'
)
and strpos(markdown_body, E'\\n') > 0;

commit;
