begin;

alter table app.group_mock_material drop constraint group_mock_material_sector_check;

alter table app.group_mock_material drop constraint group_mock_material_type_check;
alter table app.group_mock_material add constraint group_mock_material_type_check check(exercise_type in (
  'prioritisation','case_discussion','role_play','written_brief','investment_committee',
  'crisis_response','negotiation','strategy_workshop','client_pitch','data_interpretation'
));

alter table app.group_mock_material drop constraint group_mock_material_source_check;
alter table app.group_mock_material alter column originality_confirmed_by_user_id drop not null;
alter table app.group_mock_material add constraint group_mock_material_source_check check(
  (source_kind='offerlab_original' and originality_confirmed_by_user_id is not null) or
  source_kind='offerlab_synthetic'
);

alter table app.group_mock_material
  add column problem_type text not null default 'revenue_growth',
  add column skills text[] not null default array['collaboration','structured_reasoning'],
  add column recommended_group_size integer not null default 5,
  add column preparation_minutes integer not null default 10,
  add column discussion_minutes integer not null default 40,
  add column follow_up_minutes integer not null default 10;

update app.group_mock_material set
  sector=case sector
    when 'accounting_professional_services' then 'professional_services'
    when 'consulting' then 'professional_services'
    when 'financial_services' then 'challenger_banking'
    when 'general_corporate' then 'retail_consumer'
    else sector end,
  problem_type='revenue_growth',
  skills=array['collaboration','structured_reasoning','communication'],
  recommended_group_size=5,
  preparation_minutes=10,
  discussion_minutes=greatest(15,recommended_minutes-20),
  follow_up_minutes=least(10,recommended_minutes-25);

alter table app.group_mock_material add constraint group_mock_material_sector_check check(sector in (
  'professional_services','challenger_banking','insurance','asset_management','retail_consumer',
  'hospitality','energy_utilities','healthcare','higher_education','technology'
));
alter table app.group_mock_material add constraint group_mock_material_problem_check check(problem_type in (
  'esg_transition','revenue_growth','client_pitch','digital_transformation','customer_retention',
  'market_entry','cost_reduction','crisis_response','capital_allocation','workforce_strategy'
));
alter table app.group_mock_material add constraint group_mock_material_skills_check check(
  cardinality(skills) between 2 and 8 and array_position(skills,'') is null
);
alter table app.group_mock_material add constraint group_mock_material_group_size_check
  check(recommended_group_size between 3 and 8);
alter table app.group_mock_material add constraint group_mock_material_timing_check check(
  preparation_minutes between 0 and 90 and discussion_minutes between 15 and 120 and
  follow_up_minutes between 0 and 60 and
  recommended_minutes=preparation_minutes+discussion_minutes+follow_up_minutes
);

with industries(idx,sector,organisation,profile,stakeholder,industry_signal) as (
  values
    (1,'professional_services','Northstar Advisory','a UK mid-tier advisory partnership serving owner-managed and listed clients','the managing partner','Client demand is shifting toward technology-enabled delivery, but audit quality, independence and staff development cannot be compromised.'),
    (2,'challenger_banking','Lumen Bank','a mobile-first UK bank serving consumers and small businesses','the chief customer officer','Customer growth is strong while fraud losses, complaint volumes and the cost of regulatory compliance are rising.'),
    (3,'insurance','Harbour Mutual','a member-owned insurer offering home, motor and pet cover','the chief underwriting officer','Claims inflation and more frequent severe-weather events are putting affordability and underwriting discipline under pressure.'),
    (4,'asset_management','Cairn Investments','a global investment manager serving individuals, advisers and institutions','the head of responsible investment','Clients want transparent outcomes and lower fees while volatile markets and sustainability disclosures increase operating complexity.'),
    (5,'retail_consumer','Mosaic Market','an omnichannel retailer selling affordable home and lifestyle products','the commercial director','Customers are trading down, delivery returns are expensive and stores must work harder alongside the digital channel.'),
    (6,'hospitality','Juniper House','a regional group of city hotels, restaurants and event venues','the operations director','Weekend demand is healthy, weekday occupancy is uneven and labour, food and energy costs remain difficult to predict.'),
    (7,'energy_utilities','Tideway Energy','a utility balancing renewable generation, network resilience and affordability','the transition director','Grid constraints, extreme weather and household affordability make the pace and sequence of investment contentious.'),
    (8,'healthcare','Meadow Health Partnership','a not-for-profit community healthcare provider operating across three counties','the director of patient services','Waiting times and workforce vacancies are increasing while commissioners expect better access and measurable health outcomes.'),
    (9,'higher_education','Westbridge University','a research-led university with domestic and international students','the deputy vice-chancellor','Student expectations, research funding uncertainty and pressure on operating costs require choices about the institution’s future shape.'),
    (10,'technology','OrbitWorks','a growing B2B software company providing workflow tools to regulated organisations','the chief product officer','Growth has exposed reliability, cyber-security and implementation-capacity constraints while customers expect faster product improvement.')
), problems(idx,problem_type,exercise_type,label,challenge,instructions,options,deliverable,skills,debrief_one,debrief_two) as (
  values
    (1,'esg_transition','prioritisation','building a credible transition plan',
      'Leadership has committed to reduce operational emissions while protecting service quality and affordability.',
      'Assign one person to test impact, one to test feasibility and one to challenge evidence. Rank the options before agreeing a phased plan.',
      E'- Retrofit the highest-use sites\n- Change supplier standards and procurement scoring\n- Fund customer or community transition support\n- Invest in measurement, data quality and governance',
      'Recommend two actions for the next 18 months and one longer-term action, explaining cost, impact, dependencies and how greenwashing risk will be controlled.',
      array['collaboration','prioritisation','commercial_awareness','sustainability'],
      'Which trade-off between impact, cost and credibility was hardest?',
      'What evidence would you request before committing funds?'),
    (2,'revenue_growth','strategy_workshop','choosing the next growth engine',
      'Revenue growth has slowed and the board wants a sustainable route to higher income without weakening trust or service quality.',
      'Build a shared growth objective, compare the options against consistent criteria and identify the assumptions most likely to change your answer.',
      E'- Deepen the core offer for existing customers\n- Launch a premium service tier\n- Form a distribution partnership\n- Enter an adjacent customer segment',
      'Select a primary and secondary growth move, quantify the leading indicators you would track and state what the organisation should stop doing.',
      array['collaboration','commercial_awareness','data_interpretation','strategic_reasoning'],
      'How did the group distinguish revenue from profitable growth?',
      'Which assumption had the greatest influence on the recommendation?'),
    (3,'client_pitch','client_pitch','preparing a board-level client pitch',
      'A prospective client is choosing a long-term advisory partner and expects a concise response to competing board priorities.',
      'Take different stakeholder perspectives, identify their likely priorities and then combine them into one coherent proposition rather than separate mini-pitches.',
      E'- Finance: value, control and investment discipline\n- Operations: resilience, capacity and delivery\n- People: capability, inclusion and change adoption\n- Customer: trust, experience and growth',
      'Prepare a five-minute pitch with one unifying client problem, three practical workstreams, an early proof point and one question for the board.',
      array['collaboration','stakeholder_management','communication','client_focus'],
      'Did the pitch solve a client problem or merely list services?',
      'How well did the group reconcile conflicting stakeholder priorities?'),
    (4,'digital_transformation','investment_committee','selecting a responsible technology investment',
      'The organisation has a fixed transformation budget and several technology proposals with different benefits, delivery risks and data implications.',
      'Use an investment-committee approach. Agree decision criteria first, test each proposal and include adoption, security and operating-model implications.',
      E'- Automate a high-volume internal process\n- Introduce an AI-supported customer assistant\n- Replace fragmented reporting with a shared data platform\n- Modernise the core workflow and integration layer',
      'Allocate the available budget across no more than two proposals and define safeguards, ownership, adoption measures and a 90-day first milestone.',
      array['collaboration','digital_awareness','risk_judgement','investment_appraisal'],
      'How did the group balance visible innovation with foundational work?',
      'Which safeguard is essential before implementation begins?'),
    (5,'customer_retention','data_interpretation','reversing a fall in customer loyalty',
      'Repeat usage and recommendation scores have fallen despite stable headline revenue, and leaders disagree about the underlying cause.',
      'Separate facts from hypotheses. Interpret the customer, channel and service data, then agree which segment and journey should be addressed first.',
      E'- Simplify onboarding and first-use support\n- Improve complaint resolution and service recovery\n- Redesign loyalty benefits around valued behaviours\n- Remove avoidable friction from the digital journey',
      'Diagnose the most likely retention problem, choose two interventions and define an experiment with a success metric and a customer-protection check.',
      array['collaboration','data_interpretation','customer_focus','hypothesis_testing'],
      'Which data point changed the group’s initial view?',
      'How would you tell correlation from a genuine cause?'),
    (6,'market_entry','case_discussion','testing an adjacent market entry',
      'The board is considering expansion into a new UK region or customer segment but has limited evidence and only one year of investment capacity.',
      'Identify the minimum information needed, compare entry routes and distinguish reversible tests from commitments that would be difficult to unwind.',
      E'- Build a direct offer using current capabilities\n- Pilot through a local partner\n- Acquire a small specialist operator\n- Delay entry and strengthen the existing market position',
      'Recommend an entry route, a six-month test, the conditions for scaling and the clearest reason the organisation should decide not to proceed.',
      array['collaboration','market_analysis','risk_judgement','strategic_reasoning'],
      'Did the group treat “do not enter” as a genuine option?',
      'Which test provides the most learning for the least irreversible cost?'),
    (7,'cost_reduction','negotiation','closing a cost gap without hollowing out the service',
      'Operating costs are rising faster than income, but indiscriminate cuts would damage customers, employees and future capability.',
      'Represent different functions, surface protected priorities and negotiate a package that reaches the target while making consequences explicit.',
      E'- Consolidate suppliers and renegotiate contracts\n- Reduce low-value activity and simplify governance\n- Change property, capacity or shift patterns\n- Automate selected work while reinvesting in capability',
      'Agree a balanced savings package, name what will be protected, identify one reinvestment and explain how negative customer or workforce effects will be monitored.',
      array['collaboration','negotiation','financial_reasoning','stakeholder_management'],
      'What did the group protect, and why?',
      'Where did compromise improve or weaken the final package?'),
    (8,'crisis_response','crisis_response','stabilising a fast-moving service disruption',
      'A major service interruption is affecting customers and staff while facts remain incomplete and public attention is increasing.',
      'Work in short decision cycles. Separate immediate containment, stakeholder communication, service recovery and longer-term learning.',
      E'- Protect people and essential services\n- Establish verified facts and decision ownership\n- Communicate with affected stakeholders\n- Restore service safely and preserve evidence for review',
      'Present the first 60-minute response, the next 72-hour priorities, a communication principle and one decision that should wait for better evidence.',
      array['collaboration','crisis_judgement','communication','prioritisation'],
      'How did uncertainty affect the group’s decisions?',
      'Which action was urgent, and which merely felt urgent?'),
    (9,'capital_allocation','prioritisation','allocating a constrained investment fund',
      'The organisation has more viable projects than available capital and each proposal benefits a different stakeholder group.',
      'Agree weighted criteria before discussing favourite projects. Test portfolio combinations, dependencies and concentration risk.',
      E'- Expand a proven core service\n- Repair ageing operational infrastructure\n- Fund a new inclusion or access initiative\n- Create a small innovation and experimentation fund',
      'Allocate the full fund across a maximum of three proposals, explain rejected options, sequence dependencies and define one portfolio-level success measure.',
      array['collaboration','prioritisation','investment_appraisal','ethical_judgement'],
      'Were the criteria genuinely applied consistently?',
      'Which stakeholder bore the cost of the group’s choice?'),
    (10,'workforce_strategy','role_play','redesigning work for growth and resilience',
      'Demand is changing faster than workforce capability, creating workload pressure, scarce skills and concern about fairness.',
      'Represent employees, customers, operational leaders and finance. Distinguish immediate capacity relief from sustainable capability building.',
      E'- Recruit scarce specialist roles\n- Reskill existing teams and redesign career pathways\n- Use flexible partners for variable demand\n- Redesign work, technology and management practices together',
      'Agree a two-year workforce plan, one near-term workload action, principles for fair implementation and measures covering service, people and cost.',
      array['collaboration','people_judgement','change_management','stakeholder_management'],
      'Whose perspective was easiest to overlook?',
      'How did the plan address both capacity and capability?')
)
insert into app.group_mock_material(
  stable_key,title,summary,sector,exercise_type,difficulty,recommended_minutes,scenario,
  participant_instructions,information_pack,deliverable,observer_rubric,debrief_questions,
  publication_state,source_kind,originality_confirmed_at,originality_confirmed_by_user_id,
  problem_type,skills,recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes
)
select
  'library_'||lpad(industries.idx::text,2,'0')||'_'||problems.problem_type,
  industries.organisation||': '||problems.label,
  'An original, fictional '||replace(problems.exercise_type,'_',' ')||' exercise for '||industries.profile||'.',
  industries.sector,
  problems.exercise_type,
  case when (industries.idx+problems.idx)%5=0 then 'advanced'
       when (industries.idx+problems.idx)%3=0 then 'introductory' else 'standard' end,
  case when problems.problem_type in ('client_pitch','digital_transformation','workforce_strategy') then 70 else 60 end,
  industries.organisation||' is a fictional organisation created solely for practice. It is '||industries.profile||'. '||
    problems.challenge||' '||industries.industry_signal||' Your group is advising '||industries.stakeholder||'. No outside industry knowledge is required; use only the information in this pack.',
  problems.instructions||E'\n\nYou have '||case when problems.problem_type in ('client_pitch','digital_transformation','workforce_strategy') then '15' else '10' end||
    ' minutes to prepare, followed by a structured group discussion. Everyone should contribute, challenge ideas constructively and help the group reach one answer.',
    E'## Industry context\n\n'||industries.industry_signal||E'\n\n## Operating snapshot\n\n- Current income index: '||(92+industries.idx*3+problems.idx)||
    E'\n- Cost index: '||(61+industries.idx*2+problems.idx)||
    E'\n- Customer or stakeholder trust score: '||(58+(industries.idx*3+problems.idx*2)%31)||E'/100\n- Available investment units: '||(8+(industries.idx+problems.idx)%8)||
    E'\n- Delivery capacity: '||(55+(industries.idx*4+problems.idx)%36)||E'%\n\n## Options\n\n'||problems.options||
    E'\n\n## Constraints and signals\n\n- The board wants a visible first result within 90 days.\n- Front-line capacity is already stretched.\n- Any recommendation must identify who benefits, who carries risk and what evidence is still missing.\n- Figures are synthetic indices for comparison, not forecasts or claims about a real employer.',
  problems.deliverable,
  E'Assess the quality of the group process as well as the answer. Look for explicit criteria, use of the supplied evidence, inclusive turn-taking, constructive challenge, time awareness and a clear synthesis. Strong groups state uncertainty and avoid inventing facts.\n\nProblem-specific focus: '||problems.debrief_one,
  array[problems.debrief_one,problems.debrief_two,'What did the group do when members disagreed?','What would make the final recommendation more evidence-led?'],
  'published','offerlab_synthetic','2026-07-27 00:00:00+00',null,
  problems.problem_type,problems.skills,
  3+((industries.idx+problems.idx)%4),
  case when problems.problem_type in ('client_pitch','digital_transformation','workforce_strategy') then 15 else 10 end,
  40,
  case when problems.problem_type in ('client_pitch','digital_transformation','workforce_strategy') then 15 else 10 end
from industries cross join problems;

create index group_mock_material_library_filter_idx
  on app.group_mock_material(publication_state,sector,problem_type,exercise_type,difficulty,title,id);

comment on column app.group_mock_material.problem_type is 'Stable problem archetype used for library filtering.';
comment on column app.group_mock_material.skills is 'Inspectable capability focus; not an assessment score.';
comment on column app.group_mock_material.source_kind is 'offerlab_original is human-confirmed; offerlab_synthetic is an original fictional library case.';

commit;
