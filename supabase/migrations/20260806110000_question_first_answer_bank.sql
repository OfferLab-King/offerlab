begin;

alter table app.answer_coach_review
  add column suggested_answer text
  check(suggested_answer is null or char_length(suggested_answer) between 1 and 8000);

-- Move the historical catalogue out of the unique display-position range before
-- installing the founder-approved question-first order. Stable keys and member
-- answer links remain intact; inactive questions stay available to old records.
update app.interview_question
set position=position+100000,
    active=false;

insert into app.interview_question(stable_key,question_family,prompt,guidance,position,active)
values
  ('tell_me_about_yourself','personal_introduction','Tell me about yourself.','Keep this natural and concise: where you are now, the most relevant parts of your journey, and why this opportunity is the logical next step.',1,true),
  ('why_organisation','motivation_and_fit','Why do you want to work for this organisation?','Use specific reasons you can evidence. Connect what is distinctive about the organisation to what genuinely matters to you.',2,true),
  ('why_role','motivation_and_fit','Why are you interested in this role?','Show that you understand the work, explain which responsibilities appeal to you, and connect them to relevant evidence.',3,true),
  ('why_select_you','motivation_and_fit','Why should we select you?','Choose two or three relevant strengths and support each with brief evidence. Avoid unsupported claims or generic adjectives.',4,true),
  ('teamwork','competency_and_behavioural','Tell me about a time you worked effectively in a team.','Use STAR. Keep the context short and make your own actions, reasoning, result and reflection clear.',10,true),
  ('leadership','competency_and_behavioural','Tell me about a time you showed leadership.','Use STAR. Leadership can mean creating direction, influencing others or taking responsibility—not only holding a title.',11,true),
  ('problem_solving','competency_and_behavioural','Tell me about a difficult problem you solved.','Use STAR. Explain how you diagnosed the problem, compared options and chose your approach.',12,true),
  ('conflict','competency_and_behavioural','Tell me about a disagreement or conflict you handled.','Use STAR. Show how you understood the other view, handled tension constructively and reached an outcome.',13,true),
  ('setback','competency_and_behavioural','Tell me about a setback or failure.','Use STAR. Take proportionate ownership, explain your response and finish with specific learning you applied.',14,true),
  ('resilience','competency_and_behavioural','Tell me about a time you showed resilience.','Use STAR. Describe the pressure, the practical steps you took and how you maintained judgement or performance.',15,true),
  ('adapted','competency_and_behavioural','Tell me about a time you adapted to change.','Use STAR. Make the change, your response and the result concrete; avoid simply saying you stayed flexible.',16,true),
  ('initiative','competency_and_behavioural','Tell me about a time you used initiative.','Use STAR. Explain what you noticed, why action was needed and what you personally did without being prompted.',17,true),
  ('prioritised','competency_and_behavioural','Tell me about a time you prioritised competing tasks.','Use STAR. Name the competing demands and the criteria you used to make trade-offs.',18,true),
  ('communication','competency_and_behavioural','Tell me about a time you communicated a complex idea clearly.','Use STAR. Explain your audience, how you adapted the message and how you knew it was understood.',19,true)
on conflict(stable_key) do update set
  question_family=excluded.question_family,
  prompt=excluded.prompt,
  guidance=excluded.guidance,
  position=excluded.position,
  active=true;

insert into app.interview_question_stage(question_id,recruitment_stage)
select q.id,s.stage
from app.interview_question q
cross join (values('video_interview'),('interview')) s(stage)
where q.active
on conflict do nothing;

commit;
