begin;

-- Phase D: employer industry, job function and career level as first-class
-- dimensions, backward-compatible with the legacy sector/subsector model.
-- All new columns are nullable; nothing existing is altered or removed.
-- Job function must never be inferred from employer industry alone; career
-- level is a filter, never a publication gate.

create table app.employer_industry (
  industry_key text primary key,
  display_name text not null,
  position integer not null default 0,
  constraint employer_industry_key_check check (
    industry_key = btrim(industry_key) and industry_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint employer_industry_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  )
);

insert into app.employer_industry (industry_key, display_name, position) values
  ('financial_services', 'Financial Services', 1),
  ('professional_services_consulting', 'Professional Services & Consulting', 2),
  ('technology_software', 'Technology & Software', 3),
  ('engineering_manufacturing', 'Engineering & Manufacturing', 4),
  ('energy_utilities_infrastructure', 'Energy, Utilities & Infrastructure', 5),
  ('consumer_retail_fmcg', 'Consumer, Retail & FMCG', 6),
  ('healthcare_pharma_life_sciences', 'Healthcare, Pharma & Life Sciences', 7),
  ('media_telecom_entertainment', 'Media, Telecom & Entertainment', 8),
  ('transport_logistics_travel', 'Transport, Logistics & Travel', 9),
  ('real_estate_construction', 'Real Estate & Construction', 10),
  ('legal_services', 'Legal Services', 11),
  ('public_sector_government', 'Public Sector & Government', 12),
  ('education_research', 'Education & Research', 13),
  ('charity_nonprofit', 'Charity & Non-profit', 14),
  ('hospitality_leisure', 'Hospitality & Leisure', 15),
  ('other', 'Other', 200);

create table app.employer_subindustry (
  subindustry_key text primary key,
  display_name text not null,
  position integer not null default 0,
  industry_key text not null references app.employer_industry(industry_key) on delete restrict,
  constraint employer_subindustry_key_check check (
    subindustry_key = btrim(subindustry_key) and subindustry_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint employer_subindustry_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  )
);

insert into app.employer_subindustry (subindustry_key, display_name, position, industry_key) values
  ('banking', 'Banking', 1, 'financial_services'),
  ('investment_banking', 'Investment Banking', 2, 'financial_services'),
  ('asset_management', 'Asset Management', 3, 'financial_services'),
  ('wealth_management', 'Wealth Management', 4, 'financial_services'),
  ('insurance', 'Insurance', 5, 'financial_services'),
  ('fintech', 'Fintech', 6, 'financial_services'),
  ('payments', 'Payments', 7, 'financial_services'),
  ('private_markets', 'Private Markets', 8, 'financial_services'),
  ('market_infrastructure', 'Market Infrastructure', 9, 'financial_services'),
  ('lending_credit', 'Lending & Credit', 10, 'financial_services'),
  ('management_consulting', 'Management Consulting', 1, 'professional_services_consulting'),
  ('accounting_audit', 'Accounting & Audit', 2, 'professional_services_consulting'),
  ('tax_advisory', 'Tax Advisory', 3, 'professional_services_consulting'),
  ('strategy', 'Strategy', 4, 'professional_services_consulting'),
  ('outsourcing', 'Outsourcing', 5, 'professional_services_consulting'),
  ('other_professional_services', 'Other Professional Services', 200, 'professional_services_consulting'),
  ('software', 'Software', 1, 'technology_software'),
  ('it_services', 'IT Services', 2, 'technology_software'),
  ('internet_platforms', 'Internet Platforms', 3, 'technology_software'),
  ('cloud_infrastructure', 'Cloud Infrastructure', 4, 'technology_software'),
  ('cybersecurity', 'Cybersecurity', 5, 'technology_software'),
  ('other_technology', 'Other Technology', 200, 'technology_software'),
  ('aerospace_defence', 'Aerospace & Defence', 1, 'engineering_manufacturing'),
  ('automotive', 'Automotive', 2, 'engineering_manufacturing'),
  ('industrial_engineering', 'Industrial Engineering', 3, 'engineering_manufacturing'),
  ('electronics', 'Electronics', 4, 'engineering_manufacturing'),
  ('advanced_manufacturing', 'Advanced Manufacturing', 5, 'engineering_manufacturing'),
  ('other_engineering', 'Other Engineering', 200, 'engineering_manufacturing'),
  ('oil_gas', 'Oil & Gas', 1, 'energy_utilities_infrastructure'),
  ('electricity_generation', 'Electricity Generation', 2, 'energy_utilities_infrastructure'),
  ('renewables', 'Renewables', 3, 'energy_utilities_infrastructure'),
  ('utilities_networks', 'Utilities & Networks', 4, 'energy_utilities_infrastructure'),
  ('infrastructure', 'Infrastructure', 5, 'energy_utilities_infrastructure'),
  ('other_energy', 'Other Energy', 200, 'energy_utilities_infrastructure'),
  ('retail', 'Retail', 1, 'consumer_retail_fmcg'),
  ('consumer_goods', 'Consumer Goods', 2, 'consumer_retail_fmcg'),
  ('food_beverage', 'Food & Beverage', 3, 'consumer_retail_fmcg'),
  ('fashion_apparel', 'Fashion & Apparel', 4, 'consumer_retail_fmcg'),
  ('ecommerce', 'E-commerce', 5, 'consumer_retail_fmcg'),
  ('other_consumer', 'Other Consumer', 200, 'consumer_retail_fmcg'),
  ('pharmaceuticals', 'Pharmaceuticals', 1, 'healthcare_pharma_life_sciences'),
  ('medical_devices', 'Medical Devices', 2, 'healthcare_pharma_life_sciences'),
  ('healthcare_provision', 'Healthcare Provision', 3, 'healthcare_pharma_life_sciences'),
  ('life_sciences', 'Life Sciences', 4, 'healthcare_pharma_life_sciences'),
  ('biotech', 'Biotech', 5, 'healthcare_pharma_life_sciences'),
  ('other_healthcare', 'Other Healthcare', 200, 'healthcare_pharma_life_sciences'),
  ('broadcasting', 'Broadcasting', 1, 'media_telecom_entertainment'),
  ('publishing', 'Publishing', 2, 'media_telecom_entertainment'),
  ('telecoms', 'Telecoms', 3, 'media_telecom_entertainment'),
  ('entertainment', 'Entertainment', 4, 'media_telecom_entertainment'),
  ('gaming', 'Gaming', 5, 'media_telecom_entertainment'),
  ('advertising', 'Advertising', 6, 'media_telecom_entertainment'),
  ('other_media', 'Other Media', 200, 'media_telecom_entertainment'),
  ('airlines_aviation', 'Airlines & Aviation', 1, 'transport_logistics_travel'),
  ('rail', 'Rail', 2, 'transport_logistics_travel'),
  ('shipping', 'Shipping', 3, 'transport_logistics_travel'),
  ('logistics', 'Logistics', 4, 'transport_logistics_travel'),
  ('travel_tourism', 'Travel & Tourism', 5, 'transport_logistics_travel'),
  ('other_transport', 'Other Transport', 200, 'transport_logistics_travel'),
  ('real_estate', 'Real Estate', 1, 'real_estate_construction'),
  ('construction', 'Construction', 2, 'real_estate_construction'),
  ('property_development', 'Property Development', 3, 'real_estate_construction'),
  ('facilities', 'Facilities', 4, 'real_estate_construction'),
  ('other_real_estate', 'Other Real Estate', 200, 'real_estate_construction'),
  ('law_firms', 'Law Firms', 1, 'legal_services'),
  ('legal_support', 'Legal Support', 2, 'legal_services'),
  ('other_legal', 'Other Legal', 200, 'legal_services'),
  ('central_government', 'Central Government', 1, 'public_sector_government'),
  ('local_government', 'Local Government', 2, 'public_sector_government'),
  ('defence_public', 'Defence (Public)', 3, 'public_sector_government'),
  ('regulators', 'Regulators', 4, 'public_sector_government'),
  ('other_public_sector', 'Other Public Sector', 200, 'public_sector_government'),
  ('universities', 'Universities', 1, 'education_research'),
  ('schools', 'Schools', 2, 'education_research'),
  ('research_institutes', 'Research Institutes', 3, 'education_research'),
  ('edtech', 'EdTech', 4, 'education_research'),
  ('other_education', 'Other Education', 200, 'education_research'),
  ('charities', 'Charities', 1, 'charity_nonprofit'),
  ('foundations', 'Foundations', 2, 'charity_nonprofit'),
  ('social_enterprise', 'Social Enterprise', 3, 'charity_nonprofit'),
  ('other_charity', 'Other Charity', 200, 'charity_nonprofit'),
  ('hotels', 'Hotels', 1, 'hospitality_leisure'),
  ('restaurants', 'Restaurants', 2, 'hospitality_leisure'),
  ('leisure_attractions', 'Leisure Attractions', 3, 'hospitality_leisure'),
  ('events', 'Events', 4, 'hospitality_leisure'),
  ('other_hospitality', 'Other Hospitality', 200, 'hospitality_leisure');

create table app.job_function (
  function_key text primary key,
  display_name text not null,
  position integer not null default 0,
  constraint job_function_key_check check (
    function_key = btrim(function_key) and function_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint job_function_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  )
);

insert into app.job_function (function_key, display_name, position) values
  ('finance_accounting', 'Finance & Accounting', 1),
  ('investment_banking_corporate_finance', 'Investment Banking & Corporate Finance', 2),
  ('markets_trading_research', 'Markets, Trading & Research', 3),
  ('asset_wealth_investment_management', 'Asset & Wealth Management', 4),
  ('consulting_strategy', 'Consulting & Strategy', 5),
  ('software_engineering', 'Software Engineering', 6),
  ('data_analytics_ai', 'Data, Analytics & AI', 7),
  ('product_management', 'Product Management', 8),
  ('cybersecurity_it', 'Cybersecurity & IT', 9),
  ('engineering', 'Engineering', 10),
  ('science_research', 'Science & Research', 11),
  ('operations_supply_chain', 'Operations & Supply Chain', 12),
  ('project_programme_management', 'Project & Programme Management', 13),
  ('sales_business_development', 'Sales & Business Development', 14),
  ('marketing_communications', 'Marketing & Communications', 15),
  ('human_resources_recruitment', 'Human Resources & Recruitment', 16),
  ('legal', 'Legal', 17),
  ('risk_compliance_controls', 'Risk, Compliance & Controls', 18),
  ('customer_service', 'Customer Service', 19),
  ('design_ux', 'Design & UX', 20),
  ('healthcare_clinical', 'Healthcare (Clinical)', 21),
  ('public_policy_government', 'Public Policy & Government', 22),
  ('administration', 'Administration', 23),
  ('other', 'Other', 200);

create table app.job_subfunction (
  subfunction_key text primary key,
  display_name text not null,
  position integer not null default 0,
  function_key text not null references app.job_function(function_key) on delete restrict,
  constraint job_subfunction_key_check check (
    subfunction_key = btrim(subfunction_key) and subfunction_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint job_subfunction_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  )
);

insert into app.job_subfunction (subfunction_key, display_name, position, function_key) values
  ('financial_control', 'Financial Control', 1, 'finance_accounting'),
  ('tax', 'Tax', 2, 'finance_accounting'),
  ('audit', 'Audit', 3, 'finance_accounting'),
  ('treasury', 'Treasury', 4, 'finance_accounting'),
  ('financial_planning', 'Financial Planning', 5, 'finance_accounting'),
  ('other_finance', 'Other Finance', 200, 'finance_accounting'),
  ('ibd', 'Investment Banking', 1, 'investment_banking_corporate_finance'),
  ('corporate_finance', 'Corporate Finance', 2, 'investment_banking_corporate_finance'),
  ('m_and_a', 'Mergers & Acquisitions', 3, 'investment_banking_corporate_finance'),
  ('capital_markets', 'Capital Markets', 4, 'investment_banking_corporate_finance'),
  ('other_ib', 'Other Investment Banking', 200, 'investment_banking_corporate_finance'),
  ('sales_and_trading', 'Sales & Trading', 1, 'markets_trading_research'),
  ('research', 'Research', 2, 'markets_trading_research'),
  ('quant', 'Quantitative', 3, 'markets_trading_research'),
  ('structuring', 'Structuring', 4, 'markets_trading_research'),
  ('other_markets', 'Other Markets', 200, 'markets_trading_research'),
  ('asset_management', 'Asset Management', 1, 'asset_wealth_investment_management'),
  ('wealth_management', 'Wealth Management', 2, 'asset_wealth_investment_management'),
  ('private_markets', 'Private Markets', 3, 'asset_wealth_investment_management'),
  ('other_am', 'Other Asset Management', 200, 'asset_wealth_investment_management'),
  ('management_consulting', 'Management Consulting', 1, 'consulting_strategy'),
  ('strategy', 'Strategy', 2, 'consulting_strategy'),
  ('implementation', 'Implementation', 3, 'consulting_strategy'),
  ('other_consulting', 'Other Consulting', 200, 'consulting_strategy'),
  ('backend', 'Backend', 1, 'software_engineering'),
  ('frontend', 'Frontend', 2, 'software_engineering'),
  ('fullstack', 'Full-stack', 3, 'software_engineering'),
  ('mobile', 'Mobile', 4, 'software_engineering'),
  ('devops', 'DevOps', 5, 'software_engineering'),
  ('platform', 'Platform', 6, 'software_engineering'),
  ('data_engineering', 'Data Engineering', 7, 'software_engineering'),
  ('other_software', 'Other Software', 200, 'software_engineering'),
  ('analytics', 'Analytics', 1, 'data_analytics_ai'),
  ('machine_learning', 'Machine Learning', 2, 'data_analytics_ai'),
  ('data_science', 'Data Science', 3, 'data_analytics_ai'),
  ('business_intelligence', 'Business Intelligence', 4, 'data_analytics_ai'),
  ('other_data', 'Other Data', 200, 'data_analytics_ai'),
  ('product_management', 'Product Management', 1, 'product_management'),
  ('programme_management', 'Programme Management', 2, 'product_management'),
  ('product_ops', 'Product Operations', 3, 'product_management'),
  ('other_product', 'Other Product', 200, 'product_management'),
  ('security_engineering', 'Security Engineering', 1, 'cybersecurity_it'),
  ('governance', 'Governance', 2, 'cybersecurity_it'),
  ('it_support', 'IT Support', 3, 'cybersecurity_it'),
  ('cloud_platform', 'Cloud & Platform', 4, 'cybersecurity_it'),
  ('other_it', 'Other IT', 200, 'cybersecurity_it'),
  ('mechanical', 'Mechanical', 1, 'engineering'),
  ('electrical', 'Electrical', 2, 'engineering'),
  ('civil', 'Civil', 3, 'engineering'),
  ('chemical', 'Chemical', 4, 'engineering'),
  ('aerospace', 'Aerospace', 5, 'engineering'),
  ('other_engineering', 'Other Engineering', 200, 'engineering'),
  ('life_sciences', 'Life Sciences', 1, 'science_research'),
  ('physical_sciences', 'Physical Sciences', 2, 'science_research'),
  ('clinical_research', 'Clinical Research', 3, 'science_research'),
  ('other_science', 'Other Science', 200, 'science_research'),
  ('operations', 'Operations', 1, 'operations_supply_chain'),
  ('procurement', 'Procurement', 2, 'operations_supply_chain'),
  ('logistics', 'Logistics', 3, 'operations_supply_chain'),
  ('facilities', 'Facilities', 4, 'operations_supply_chain'),
  ('other_ops', 'Other Operations', 200, 'operations_supply_chain'),
  ('project_management', 'Project Management', 1, 'project_programme_management'),
  ('pm_programme_management', 'Programme Management', 2, 'project_programme_management'),
  ('agile', 'Agile', 3, 'project_programme_management'),
  ('other_pm', 'Other Programme Management', 200, 'project_programme_management'),
  ('sales', 'Sales', 1, 'sales_business_development'),
  ('business_development', 'Business Development', 2, 'sales_business_development'),
  ('account_management', 'Account Management', 3, 'sales_business_development'),
  ('other_sales', 'Other Sales', 200, 'sales_business_development'),
  ('marketing', 'Marketing', 1, 'marketing_communications'),
  ('communications', 'Communications', 2, 'marketing_communications'),
  ('brand', 'Brand', 3, 'marketing_communications'),
  ('social', 'Social', 4, 'marketing_communications'),
  ('other_marketing', 'Other Marketing', 200, 'marketing_communications'),
  ('hr_business_partnering', 'HR Business Partnering', 1, 'human_resources_recruitment'),
  ('recruitment', 'Recruitment', 2, 'human_resources_recruitment'),
  ('learning_development', 'Learning & Development', 3, 'human_resources_recruitment'),
  ('people_ops', 'People Operations', 4, 'human_resources_recruitment'),
  ('other_hr', 'Other HR', 200, 'human_resources_recruitment'),
  ('legal_counsel', 'Legal Counsel', 1, 'legal'),
  ('compliance_legal', 'Compliance (Legal)', 2, 'legal'),
  ('paralegal', 'Paralegal', 3, 'legal'),
  ('other_legal', 'Other Legal', 200, 'legal'),
  ('risk', 'Risk', 1, 'risk_compliance_controls'),
  ('compliance', 'Compliance', 2, 'risk_compliance_controls'),
  ('financial_crime', 'Financial Crime', 3, 'risk_compliance_controls'),
  ('internal_audit', 'Internal Audit', 4, 'risk_compliance_controls'),
  ('other_risk', 'Other Risk', 200, 'risk_compliance_controls'),
  ('customer_support', 'Customer Support', 1, 'customer_service'),
  ('client_service', 'Client Service', 2, 'customer_service'),
  ('operations_customer', 'Customer Operations', 3, 'customer_service'),
  ('other_customer', 'Other Customer Service', 200, 'customer_service'),
  ('ux_design', 'UX Design', 1, 'design_ux'),
  ('ui_design', 'UI Design', 2, 'design_ux'),
  ('research_design', 'Design Research', 3, 'design_ux'),
  ('other_design', 'Other Design', 200, 'design_ux'),
  ('clinical', 'Clinical', 1, 'healthcare_clinical'),
  ('nursing', 'Nursing', 2, 'healthcare_clinical'),
  ('pharmacy', 'Pharmacy', 3, 'healthcare_clinical'),
  ('other_clinical', 'Other Clinical', 200, 'healthcare_clinical'),
  ('policy', 'Policy', 1, 'public_policy_government'),
  ('public_affairs', 'Public Affairs', 2, 'public_policy_government'),
  ('government_relations', 'Government Relations', 3, 'public_policy_government'),
  ('other_policy', 'Other Policy', 200, 'public_policy_government'),
  ('executive_support', 'Executive Support', 1, 'administration'),
  ('office_management', 'Office Management', 2, 'administration'),
  ('other_admin', 'Other Administration', 200, 'administration');

create table app.job_career_level (
  level_key text primary key,
  display_name text not null,
  position integer not null default 0,
  constraint job_career_level_key_check check (
    level_key = btrim(level_key) and level_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint job_career_level_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  )
);

insert into app.job_career_level (level_key, display_name, position) values
  ('school_leaver', 'School leaver', 1),
  ('student', 'Student', 2),
  ('intern', 'Intern', 3),
  ('graduate', 'Graduate', 4),
  ('entry_level', 'Entry level', 5),
  ('junior', 'Junior', 6),
  ('experienced', 'Experienced', 7),
  ('manager', 'Manager', 8),
  ('senior_leadership', 'Senior leadership', 9),
  ('unknown', 'Unknown', 200);

alter table app.company
  add column employer_industry_key text references app.employer_industry(industry_key) on delete restrict,
  add column employer_subindustry_key text references app.employer_subindustry(subindustry_key) on delete restrict;

alter table app.job
  add column job_function_key text references app.job_function(function_key) on delete restrict,
  add column job_subfunction_key text references app.job_subfunction(subfunction_key) on delete restrict,
  add column career_level_key text references app.job_career_level(level_key) on delete restrict;

create index company_employer_industry_idx on app.company (employer_industry_key)
  where employer_industry_key is not null;
create index job_function_idx on app.job (job_function_key)
  where job_function_key is not null;
create index job_career_level_idx on app.job (career_level_key)
  where career_level_key is not null;

-- Grants: reference tables readable by the app role and crawler (like the
-- legacy job_sector/job_subsector tables); new job columns readable and
-- writable by the classification pipeline roles.

alter table app.employer_industry enable row level security;
alter table app.employer_industry force row level security;
alter table app.employer_subindustry enable row level security;
alter table app.employer_subindustry force row level security;
alter table app.job_function enable row level security;
alter table app.job_function force row level security;
alter table app.job_subfunction enable row level security;
alter table app.job_subfunction force row level security;
alter table app.job_career_level enable row level security;
alter table app.job_career_level force row level security;

create policy taxonomy_dimension_read on app.employer_industry
  for select to offerlab_app using (true);
create policy taxonomy_dimension_read on app.employer_subindustry
  for select to offerlab_app using (true);
create policy taxonomy_dimension_read on app.job_function
  for select to offerlab_app using (true);
create policy taxonomy_dimension_read on app.job_subfunction
  for select to offerlab_app using (true);
create policy taxonomy_dimension_read on app.job_career_level
  for select to offerlab_app using (true);

create policy taxonomy_dimension_crawler_read on app.employer_industry
  for select to offerlab_crawler using (true);
create policy taxonomy_dimension_crawler_read on app.employer_subindustry
  for select to offerlab_crawler using (true);
create policy taxonomy_dimension_crawler_read on app.job_function
  for select to offerlab_crawler using (true);
create policy taxonomy_dimension_crawler_read on app.job_subfunction
  for select to offerlab_crawler using (true);
create policy taxonomy_dimension_crawler_read on app.job_career_level
  for select to offerlab_crawler using (true);

grant select on app.employer_industry, app.employer_subindustry,
  app.job_function, app.job_subfunction, app.job_career_level
  to offerlab_app;
grant select on app.employer_industry, app.employer_subindustry,
  app.job_function, app.job_subfunction, app.job_career_level
  to offerlab_crawler;

grant select (employer_industry_key, employer_subindustry_key) on app.company to offerlab_app;
grant select (job_function_key, job_subfunction_key, career_level_key) on app.job to offerlab_app;
grant update (job_function_key, job_subfunction_key, career_level_key,
  sector_key, subsector_key, opportunity_type, updated_at)
  on app.job to offerlab_app;
grant update (job_function_key, job_subfunction_key, career_level_key,
  sector_key, subsector_key, opportunity_type, updated_at)
  on app.job to offerlab_crawler;

comment on table app.employer_industry is
  'Canonical employer industry dimension (Phase D); employer facts only.';
comment on table app.job_function is
  'Canonical job function dimension (Phase D); never inferred from employer industry.';
comment on table app.job_career_level is
  'Career level dimension (Phase D); a filter, never a publication gate.';

commit;
