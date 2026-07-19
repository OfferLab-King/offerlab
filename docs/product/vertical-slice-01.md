# OfferLab Vertical Slice 01

**Document version:** 0.1  
**Status:** Ready for architecture review  
**Slice name:** Stage-Based Application Guidance  
**Related documents:** `mvp-brief.md`, `critical-user-journey.md`, `screen-map.md`

---

## 1. Objective

Implement the first end-to-end product capability that demonstrates OfferLab's central value:

> A registered user completes onboarding, adds an application, and receives relevant preparation recommendations based on the application's recruitment stage and deadline.

This slice should prove:

- the core domain model
- authentication and user isolation
- stage-based product guidance
- the basic dashboard
- application tracking
- rule-based recommendations
- testing and delivery foundations

It should be production-quality within its defined scope, but it should not attempt to implement the full MVP.

---

## 2. Why this slice comes first

This slice tests the most important product assumption:

> Students will find value in a platform that understands where they are in recruitment and tells them what to prepare next.

It also establishes technical foundations needed by later features:

- users
- profiles
- onboarding
- applications
- recruitment stages
- content references
- recommendation rules
- dashboard queries
- permissions
- admin management
- analytics events
- automated tests

---

## 3. User story

### Primary user story

As a graduate applicant, I want to add an application and record its current recruitment stage so that OfferLab can show me what I should prepare next.

### Supporting user stories

As a new member, I want to complete a short onboarding flow so the platform can understand my context.

As a member, I want my applications to remain private.

As a member, I want to update an application's stage and immediately receive new recommendations.

As an administrator, I want to manage recommendation mappings without editing application code, where practical.

As a developer, I want reliable validation, tests and CI so future Codex agents can extend the system safely.

---

## 4. In scope

## 4.1 Repository and engineering foundation

- Repository structure
- `AGENTS.md`
- Local development instructions
- Environment-variable template
- Formatting
- Linting
- Type checking
- Unit tests
- Integration tests
- Basic end-to-end test
- CI workflow
- Database migrations
- Seed data
- Development database
- Error logging foundation
- Health check
- Secure configuration conventions

## 4.2 Authentication

- Account registration or development-compatible managed authentication
- Sign in
- Sign out
- Email identity
- Authenticated route protection
- User record linkage
- Basic administrator role
- Test-user support

Payment and active subscription enforcement are excluded from this slice.

## 4.3 User profile and onboarding

Capture:

- education or career stage
- opportunity type
- target industries
- current recruitment stages
- nearest important deadline
- main preparation priorities

Support:

- first-time onboarding
- optional-field skipping
- later editing
- completion status

## 4.4 Applications

Support:

- create application
- list applications
- view application
- edit application
- update stage
- archive application

Required fields:

- company
- role
- opportunity type
- location
- current stage
- application deadline, optional
- next-stage deadline, optional
- notes, optional

## 4.5 Recruitment stages

Initial controlled values:

- Planning
- Application started
- Application submitted
- Online test
- Video interview
- Telephone interview
- Assessment centre
- Final interview
- Offer
- Rejected
- Withdrawn

The implementation should use stable internal identifiers rather than relying on display labels.

## 4.6 Preparation resources

For this slice, preparation resources may be seed records rather than a full CMS.

Minimum resource fields:

- stable identifier
- title
- short description
- resource type
- destination path or URL
- active status

Seed at least:

- Video interview preparation
- Motivation question guide
- Teamwork example guide
- Recording checklist
- Online test preparation
- Assessment-centre group exercise guide
- Final interview preparation
- Application planning checklist

The destination may initially be a placeholder detail page.

## 4.7 Recommendation rules

A recommendation rule maps user or application context to a preparation resource.

Minimum rule inputs:

- application stage
- optional deadline window
- optional opportunity type
- priority
- active status

Minimum rule output:

- preparation resource

Example:

```text
Stage: Video interview
Deadline window: 0–7 days
Priority: High
Resource: Video interview preparation
```

Rules must be deterministic and testable.

## 4.8 Member dashboard

Show:

- onboarding status
- active applications
- upcoming deadlines
- stage-based recommendations
- prompt to add an application
- prompt to complete onboarding

Recommendations should explain why they appear in simple language.

Example:

> Recommended because your Deloitte video interview is in five days.

## 4.9 Basic administration

Administrator can:

- list recommendation rules
- create a rule
- edit a rule
- activate or deactivate a rule
- view preparation resources

A full content CMS is excluded.

## 4.10 Analytics events

At minimum:

- onboarding started
- onboarding completed
- application created
- application edited
- application stage updated
- application archived
- recommendation displayed
- recommendation opened

Use a replaceable analytics abstraction. Do not send application notes or sensitive free text.

---

## 5. Out of scope

Do not implement:

- Stripe or paid membership
- subscription enforcement
- recruitment report database
- recruitment report submission
- report moderation
- community discussion
- full content CMS
- learning path progress
- annotated coaching cases
- saved resources
- email notifications
- deadline reminder jobs
- mentor marketplace
- Group Mock matching
- AI features
- volunteering or project programmes
- native mobile application
- multi-language support
- employer or university accounts
- social login unless selected as part of managed authentication
- complex role hierarchy
- microservices
- event-driven distributed architecture
- advanced search infrastructure

Unrelated refactoring is prohibited.

---

## 6. Main user flow

```text
User creates account
    ↓
User signs in
    ↓
User is redirected to onboarding
    ↓
User completes required onboarding questions
    ↓
User is prompted to add first application
    ↓
User adds company, role, stage and deadline
    ↓
Application is saved
    ↓
Dashboard calculates matching recommendation rules
    ↓
Dashboard shows ordered preparation recommendations
    ↓
User opens a recommendation
    ↓
User changes application stage
    ↓
Dashboard recommendations update
```

---

## 7. Functional requirements

## FR-01 — Authentication

- Unauthenticated users cannot access member or admin routes.
- Authenticated users can sign out.
- A user record is created or linked safely.
- Administrator routes require administrator role.
- Authentication failures do not expose internal details.

## FR-02 — Onboarding completion

- New users are redirected to onboarding until required fields are completed.
- Optional fields can be skipped.
- Progress is persisted between steps.
- The user can edit onboarding answers later.
- Completion status is stored explicitly.

## FR-03 — Application creation

- A member can create an application.
- Company and role are required.
- Stage is required.
- Deadlines are optional.
- A deadline cannot be invalidly formatted.
- A member cannot create or modify applications for another member.

## FR-04 — Application management

- A member can list active applications.
- A member can open one application.
- A member can edit allowed fields.
- A member can update the stage.
- A member can archive an application.
- Archived applications are excluded from the default dashboard.

## FR-05 — Recommendation calculation

- Recommendations are generated from active rules.
- Stage matching is required.
- Deadline-window rules apply only when a relevant deadline exists.
- More specific rules should rank above less specific rules.
- Explicit priority resolves ordering.
- Duplicate resources should appear only once per application context.
- Inactive resources or rules must not appear.
- Recommendation calculation must be unit tested.

## FR-06 — Dashboard

- New users with incomplete onboarding see a completion prompt.
- Users with no applications see an add-application prompt.
- Users with applications see active applications and recommendations.
- Deadlines within seven days are visually prominent.
- Past deadlines are clearly indicated.
- Errors in one dashboard section should not necessarily prevent all other sections from rendering, where practical.

## FR-07 — Administration

- Administrators can list, create and edit rules.
- Invalid resource references are rejected.
- Rule changes take effect without redeploying application code.
- Administrative changes are logged at least through structured application logs or an audit record.

## FR-08 — Privacy and access control

- All application queries are scoped to the authenticated member.
- Direct-object access attempts to another user's application are denied.
- Notes are never included in analytics.
- Administrator access to member application data is not required for this slice and should not be added by default.

---

## 8. Suggested domain model

This is a product-level suggestion, not a mandatory database design.

## User

- id
- email
- role
- created_at
- updated_at

## UserProfile

- user_id
- education_stage
- opportunity_types
- target_industries
- current_recruitment_stages
- nearest_deadline
- preparation_priorities
- onboarding_completed_at
- created_at
- updated_at

## Application

- id
- user_id
- company_name
- role_name
- opportunity_type
- location
- stage_id
- application_deadline
- next_stage_deadline
- notes
- archived_at
- created_at
- updated_at

## RecruitmentStage

- id
- key
- display_name
- sort_order
- terminal_outcome
- active

## PreparationResource

- id
- key
- title
- description
- resource_type
- destination
- active
- created_at
- updated_at

## RecommendationRule

- id
- stage_id
- deadline_min_days, optional
- deadline_max_days, optional
- opportunity_type, optional
- preparation_resource_id
- priority
- active
- created_at
- updated_at

## RecommendationInteraction

Optional in this slice:

- id
- user_id
- application_id
- preparation_resource_id
- event_type
- created_at

## AuditEvent

Optional but recommended for admin changes:

- id
- actor_user_id
- action
- entity_type
- entity_id
- metadata
- created_at

---

## 9. Recommendation behaviour

## 9.1 Relevant deadline

Use the next-stage deadline when available.

Otherwise use the application deadline.

If neither exists, only rules without a deadline window are eligible.

## 9.2 Deadline distance

Calculate whole calendar days using a documented timezone strategy.

Do not silently mix browser local time, server time and UTC.

## 9.3 Matching order

Recommended order:

1. Exact stage + deadline window + opportunity type
2. Exact stage + deadline window
3. Exact stage + opportunity type
4. Exact stage
5. Priority descending
6. Stable tie-breaker

## 9.4 Deduplication

If multiple rules return the same resource, show it once using the highest-ranked matching rule.

## 9.5 Maximum recommendations

Show a reasonable maximum, such as five primary recommendations per application, unless product review decides otherwise.

## 9.6 Explanation

Each recommendation should expose a user-friendly reason derived from the rule, not generated by AI.

Examples:

- Recommended for your upcoming video interview.
- Recommended because your assessment centre is within seven days.
- Recommended for internship applications at the online-test stage.

---

## 10. Required screens

This slice should implement at least:

- Sign in
- Create account, if not delegated entirely to provider
- Onboarding
- Dashboard
- Applications list
- Add application
- Application detail
- Edit application
- Update stage
- Preparation resource placeholder detail
- Admin recommendation rules list
- Admin recommendation rule editor
- Access denied
- Not found
- Generic error state

Visual polish should be coherent but not treated as a complete design system.

---

## 11. Acceptance criteria

## AC-01 — New-user flow

Given a new authenticated user  
When they first access the member application  
Then they are directed to onboarding.

Given the user completes required onboarding fields  
When they submit the final step  
Then onboarding is marked complete and they are prompted to add an application.

## AC-02 — Application creation

Given an onboarded user  
When they enter company, role and stage  
Then the application is created and appears on their dashboard.

Given the user omits a required field  
When they submit  
Then the form shows a clear validation message and preserves other entered values.

## AC-03 — Recommendation display

Given an application at the video-interview stage  
And active recommendation rules exist  
When the dashboard loads  
Then matching resources are displayed in priority order.

Given the same resource matches multiple rules  
Then it appears only once.

Given a rule or resource is inactive  
Then it is not displayed.

## AC-04 — Deadline-sensitive recommendation

Given an application's relevant deadline is five days away  
And a matching zero-to-seven-day rule exists  
When recommendations are calculated  
Then the deadline-sensitive rule is eligible and ranked above a generic stage rule.

Given no deadline exists  
Then deadline-window rules are not matched.

## AC-05 — Stage change

Given an application at the online-test stage  
When the member changes the stage to assessment centre  
Then the dashboard no longer shows online-test-only recommendations and shows assessment-centre recommendations.

## AC-06 — Privacy

Given two different members  
When member A attempts to request member B's application identifier  
Then access is denied and no application data is returned.

## AC-07 — Administration

Given an administrator  
When they create a valid active rule  
Then the rule becomes available to recommendation calculation without an application redeployment.

Given a non-administrator  
When they attempt to access admin routes  
Then access is denied.

## AC-08 — Mobile usability

Given a standard mobile viewport  
When the member completes onboarding, adds an application and views recommendations  
Then all required actions remain usable without horizontal scrolling.

## AC-09 — Quality gates

A change cannot merge unless:

- formatting passes
- linting passes
- type checking passes
- unit tests pass
- integration tests pass
- the primary end-to-end journey passes
- database migration validation passes
- no high-severity dependency or secret-scanning failure is present, subject to documented policy

---

## 12. Test scenarios

## Unit tests

- deadline calculation
- stage matching
- opportunity-type matching
- rule priority
- specificity ranking
- deduplication
- inactive rule exclusion
- inactive resource exclusion
- maximum recommendation count
- explanation text selection

## Integration tests

- create user profile
- complete onboarding
- create application
- update application
- archive application
- user-scoped application query
- administrator rule CRUD
- unauthorised admin access
- recommendation query with seeded rules

## End-to-end test

1. Authenticate as test user.
2. Complete onboarding.
3. Add Deloitte Consulting Graduate application.
4. Set stage to Video interview.
5. Set deadline five days ahead.
6. Open dashboard.
7. Confirm video interview and related recommendations appear.
8. Open one recommendation.
9. Return to application.
10. Change stage to Assessment centre.
11. Confirm dashboard recommendations change.
12. Archive application.
13. Confirm it leaves the active dashboard.

## Security tests

- horizontal application access
- unauthorised admin access
- forged user identifier
- invalid stage identifier
- malformed date
- notes excluded from analytics payload
- unsafe redirect prevention where applicable

---

## 13. Seed data

## Recruitment stages

Seed all initial controlled stages.

## Preparation resources

Seed at least eight resources.

## Recommendation rules

Seed realistic combinations, including:

### Video interview

- Generic video interview preparation
- Motivation question guide
- Teamwork example guide
- Recording checklist
- Urgent zero-to-seven-day preparation rule

### Online test

- Online test preparation
- Time-management checklist

### Assessment centre

- Group exercise guide
- Professional discussion phrases
- Assessment-centre checklist

### Final interview

- Final interview preparation
- Motivation and commercial-awareness review

## Test users

- Standard onboarded member
- Standard non-onboarded member
- Administrator
- Second member for access-control tests

---

## 14. Non-functional requirements

## Performance

- Dashboard should load within a reasonable interactive threshold under expected MVP usage.
- Recommendation calculation should not require external AI or search services.
- Database queries should avoid obvious per-application query multiplication.

## Reliability

- Database writes should be transactional where needed.
- Form resubmission should not unintentionally create duplicates.
- Migrations should be reversible where practical and tested.

## Security

- Secrets must not be committed.
- Authentication and authorisation must be enforced server-side.
- Inputs must be validated server-side.
- Logs must not contain passwords, tokens or sensitive notes.
- Common web-security protections should be enabled.

## Accessibility

- Forms have labels and clear validation.
- Keyboard navigation works for core flows.
- Focus states are visible.
- Status is not communicated by colour alone.

## Maintainability

- Recommendation logic should be isolated behind a clear interface.
- Domain rules should not be duplicated across UI and server layers.
- Architecture should support later addition of payments, content and reports without premature microservices.

## Observability

- Structured error logs
- health endpoint
- request correlation where practical
- analytics abstraction
- clear local debugging instructions

---

## 15. AGENTS.md requirements

Codex should create an `AGENTS.md` that includes:

- product context
- source-of-truth document locations
- architecture overview
- repository boundaries
- commands for install, run, lint, format, type-check and test
- migration workflow
- seed-data workflow
- test-account workflow
- environment-variable policy
- security constraints
- prohibition against unrelated refactoring
- requirement to update tests with behaviour changes
- requirement to record significant architecture decisions
- definition of done
- instructions for handling ambiguous requirements

The file should be concise enough to be used routinely by coding agents.

---

## 16. CI requirements

On pull requests, CI should run:

1. Dependency installation using a locked dependency file.
2. Formatting check.
3. Lint.
4. Type check.
5. Unit tests.
6. Integration tests.
7. Database migration validation.
8. Build.
9. Primary end-to-end test where practical.
10. Secret scanning.
11. Dependency or vulnerability checks under a documented severity policy.

CI should fail clearly and provide actionable output.

---

## 17. Definition of done

Vertical Slice 01 is complete when:

1. A new user can authenticate.
2. They complete onboarding.
3. They add an application.
4. Their application is private to them.
5. The dashboard shows deterministic recommendations.
6. Deadline-sensitive rules work.
7. They can update the stage and see recommendations change.
8. They can archive the application.
9. An administrator can manage recommendation rules.
10. Automated tests cover the main domain logic and critical journey.
11. CI validates all required checks.
12. Local setup is documented and repeatable.
13. Seed data supports a realistic demonstration.
14. No excluded feature has been partially introduced without approval.
15. The founder can manually test the complete slice using realistic student scenarios.

---

## 18. Architecture-review questions for Codex

Before implementation, Codex should answer:

1. Which architecture best fits a solo technical founder working alongside a full-time job?
2. Which authentication approach minimises operational burden without creating harmful lock-in?
3. Which relational database and hosting approach are appropriate?
4. Should the application be a modular monolith, and how should modules be separated?
5. How should rule evaluation be isolated and tested?
6. How should the admin interface be implemented without building a second application unnecessarily?
7. How should local development, test and production environments differ?
8. What deployment path provides the lowest reasonable operational burden?
9. How will migrations, backups and rollbacks work?
10. Which decisions should be recorded as architecture decision records?
11. Which parts of this slice create the most future migration risk?
12. What should explicitly not be abstracted yet?

Codex must present options and trade-offs before scaffolding the repository.

---

## 19. Implementation instruction

After architecture approval, implementation should proceed sequentially:

1. Repository foundation
2. Authentication and user linkage
3. Domain schema and migrations
4. Onboarding
5. Application CRUD and access control
6. Preparation resources and seed data
7. Recommendation engine
8. Dashboard
9. Admin rule management
10. Analytics events
11. Automated tests
12. CI
13. Documentation
14. Human acceptance testing

Parallel agents should only be introduced after module boundaries, file ownership and integration checks are clear.
