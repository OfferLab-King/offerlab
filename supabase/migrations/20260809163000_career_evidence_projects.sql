begin;

insert into app.content_tag(slug,name,normalized_name) values
  ('skills-development','Skills development','skills development'),
  ('portfolio-project','Portfolio project','portfolio project'),
  ('data-analysis','Data analysis','data analysis'),
  ('sql','SQL','sql'),
  ('python','Python','python'),
  ('power-bi','Power BI','power bi'),
  ('excel','Excel','excel')
on conflict(slug) do nothing;

insert into app.preparation_resource(
  resource_key,slug,title,short_description,resource_type,access_level,publication_state,
  markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at
)
select v.resource_key,v.slug,v.title,v.summary,'exercise','member','published',v.body,c.id,v.minutes,clock_timestamp(),clock_timestamp()
from (values
  (
    'role_evidence_project','role-evidence-project','Plan a role-relevant evidence project',
    'Turn a genuine capability gap into a small, inspectable project and truthful CV evidence.',20,
    '## Start with the gap\n\nCopy the requirement into your private notes, then describe what competent performance would produce. Do not add the skill to your CV yet.\n\n## Define a bounded deliverable\n\nChoose a real or realistic audience, a small output and a completion date. Examples include an analysis, prototype, briefing, process improvement or research recommendation.\n\n## Make the evidence inspectable\n\nKeep the brief, working decisions, output and feedback. When complete, write a CV bullet using **action — method — outcome**, stating only what happened.\n\n## Quality check\n\n- Can you explain your individual decisions?\n- Can you show or describe the output?\n- Can you state the limitation as well as the result?\n- Is every CV claim supported by the project record?'
  ),
  (
    'sql_evidence_project','sql-evidence-project','Build a SQL evidence project',
    'Create a compact SQL analysis that demonstrates querying, checks and decision-focused communication.',35,
    '## Project brief\n\nChoose a public dataset and define three questions for a specific audience. Import it into a relational database and keep the source link.\n\n## Required evidence\n\n- queries using filtering, joins and aggregation;\n- at least one data-quality check;\n- a short explanation of why each query answers the question;\n- a concise summary of findings and limitations.\n\n## Turn it into CV evidence\n\nName the dataset, SQL techniques and decision supported. Do not claim business impact unless a real stakeholder used the work.'
  ),
  (
    'dashboard_evidence_project','dashboard-evidence-project','Build a dashboard evidence project',
    'Develop an audience-led dashboard and record the data, design and decision choices behind it.',40,
    '## Project brief\n\nChoose a dataset and a named audience. Write down the decisions that audience needs to make before opening Power BI, Tableau or another visualisation tool.\n\n## Required evidence\n\n- documented cleaning and transformation choices;\n- a small, coherent data model;\n- measures tied to the audience questions;\n- charts selected for a reason, not decoration;\n- one recommendation and one limitation.\n\n## Turn it into CV evidence\n\nState the tool, data handled, dashboard purpose and insight produced. Keep usage or impact claims out unless they really occurred.'
  ),
  (
    'python_data_evidence_project','python-data-evidence-project','Build a Python data-analysis project',
    'Produce a reproducible notebook that shows data cleaning, analysis, judgement and limitations.',40,
    '## Project brief\n\nSelect a public CSV or API dataset and write one focused analysis question. Use a notebook or script that another person can run.\n\n## Required evidence\n\n- explicit data-quality checks;\n- clear transformations using Python and, where useful, pandas;\n- analysis or visualisation connected to the question;\n- plain-English findings;\n- assumptions and limitations.\n\n## Turn it into CV evidence\n\nDescribe the question, method and finding. A repository link supports the claim, but the CV bullet should still explain your judgement.'
  ),
  (
    'spreadsheet_analysis_evidence_project','spreadsheet-analysis-evidence-project','Build a spreadsheet analysis project',
    'Create an auditable Excel workbook with clean inputs, reliable calculations and a useful summary.',30,
    '## Project brief\n\nChoose a public dataset and a practical reporting question. Keep raw inputs separate from calculations and outputs.\n\n## Required evidence\n\n- documented cleaning and validation;\n- appropriate formulas, lookups or pivot tables;\n- checks for missing or inconsistent values;\n- a concise summary or dashboard for the intended reader.\n\n## Turn it into CV evidence\n\nName the workbook purpose, techniques used and conclusion supported. Do not describe a personal exercise as employer delivery.'
  )
) as v(resource_key,slug,title,summary,minutes,body)
join app.content_category c on c.slug='applications'
on conflict(resource_key) do nothing;

insert into app.preparation_resource_tag(resource_id,tag_id)
select r.id,t.id
from app.preparation_resource r
join app.content_tag t on (
  t.slug in ('skills-development','portfolio-project')
  or (r.resource_key='sql_evidence_project' and t.slug in ('sql','data-analysis'))
  or (r.resource_key='dashboard_evidence_project' and t.slug in ('power-bi','data-analysis'))
  or (r.resource_key='python_data_evidence_project' and t.slug in ('python','data-analysis'))
  or (r.resource_key='spreadsheet_analysis_evidence_project' and t.slug in ('excel','data-analysis'))
)
where r.resource_key in (
  'role_evidence_project','sql_evidence_project','dashboard_evidence_project',
  'python_data_evidence_project','spreadsheet_analysis_evidence_project'
)
on conflict do nothing;

comment on table app.preparation_resource is
  'Canonical OfferLab library content, including contextual evidence-building projects. External course recommendations remain separately curated and do not imply outcome guarantees.';

commit;
