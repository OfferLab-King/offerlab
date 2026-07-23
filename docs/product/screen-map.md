# OfferLab MVP Screen Map

**Document version:** 0.1  
**Status:** Draft for architecture and UX review  
**Related documents:** `mvp-brief.md`, `critical-user-journey.md`

> **Current UX authority:** `experience-principles.md` governs implementation. This draft inventory describes possible capabilities, not a requirement for large instructional screens, fixed progression, central next-action panels or progress displays without practical decision value.

---

## 1. Purpose

This document lists the screens required for the OfferLab MVP.

For every screen, it defines:

- purpose
- intended user
- primary action
- required information
- key states
- access rules
- analytics expectations

This is not a final visual design specification. It is a functional screen inventory that should inform wireframes, architecture and backlog generation.

---

## 2. Navigation model

## Public navigation

- Home
- How it works
- Membership
- Selected free resources
- Sign in
- Join

## Member navigation

- Dashboard
- Applications
- Learn
- Recruitment Reports
- Community
- Saved
- Account

## Administrator navigation

- Admin Dashboard
- Content
- Learning Paths
- Coaching Cases
- Recruitment Reports
- Community Moderation
- Recommendation Rules
- Users
- Memberships
- Taxonomy
- Analytics
- Settings

---

# 3. Public screens

## P01 — Landing page

### Purpose

Explain OfferLab's value and convert a relevant visitor into a member.

### Primary action

`Join OfferLab`

### Secondary actions

- See how it works
- View membership
- Sign in
- Explore selected free content

### Required sections

- Hero and product promise
- Target user
- Main problems solved
- Product components
- Community intelligence explanation
- Annotated coaching example preview
- How the journey works
- Membership pricing
- Trust and confidentiality
- Frequently asked questions
- Final call to action

### States

- Default
- Returning signed-in member
- Campaign-specific landing variant, optional later

### Analytics

- page viewed
- pricing viewed
- join clicked
- sign-in clicked
- free resource opened

---

## P02 — How it works

### Purpose

Show the complete member journey.

### Primary action

`Join OfferLab`

### Required sections

1. Add applications
2. Receive preparation guidance
3. Learn through frameworks and examples
4. Read current candidate reports
5. contribute to the community

### Empty/error states

Not applicable beyond standard page errors.

---

## P03 — Membership and pricing

### Purpose

Explain plans, access and cancellation terms.

### Primary action

`Choose plan`

### Required information

- Monthly plan
- Recruitment-season plan
- Included features
- Billing frequency
- cancellation behaviour
- refund policy
- contributor rewards
- FAQ

### States

- Plan available
- Plan temporarily unavailable
- Existing active member
- Existing cancelled member with remaining access

---

## P04 — Selected free resource page

### Purpose

Demonstrate OfferLab's methodology and support public discovery.

### Primary action

`Join to continue`

### Required content

- public lesson or framework
- related premium resource previews
- clear distinction between public and member content

### Access

Public.

---

## P05 — Sign in

### Purpose

Authenticate an existing user.

### Primary action

`Sign in`

### Secondary actions

- Forgot password
- Create account
- Resend verification

### States

- Default
- Invalid credentials
- Unverified email
- Locked or rate-limited
- Existing authenticated session

---

## P06 — Create account

### Purpose

Register a new user.

### Primary action

`Create account`

### Required fields

- Email
- Password, unless using approved identity provider
- Terms and privacy acceptance

### States

- Default
- Email already exists
- Password invalid
- Submission failed
- Registration succeeded

---

## P07 — Verify email

### Purpose

Confirm ownership of the user's email address.

### Primary action

`Continue`

### Secondary action

`Resend verification email`

### States

- Pending
- Verified
- Link expired
- Link invalid
- Resend successful
- Resend rate-limited

---

## P08 — Password reset request

### Purpose

Start password recovery.

### Primary action

`Send reset link`

### States

- Default
- Email submitted
- Rate-limited
- Submission error

---

## P09 — Set new password

### Purpose

Complete password recovery.

### Primary action

`Set new password`

### States

- Valid link
- Expired link
- Invalid password
- Success

---

# 4. Purchase and onboarding screens

## M01 — Choose membership

### Purpose

Allow a verified user to choose a plan.

### Primary action

`Continue to payment`

### Required information

- Plan names
- Billing periods
- Price
- Included access
- cancellation terms

### States

- Eligible user
- Existing active member
- Existing plan requiring management rather than new purchase

---

## M02 — Checkout

### Purpose

Complete payment through the payment provider.

### Primary action

`Pay and join`

### States

- Loading
- Payment ready
- Additional authentication required
- Payment failed
- Payment succeeded
- Abandoned checkout

### Security

Payment card data should be handled by the payment provider, not OfferLab servers.

---

## M03 — Payment result

### Purpose

Confirm membership activation or explain failure.

### Primary action on success

`Start onboarding`

### Primary action on failure

`Try again`

### States

- Success
- Pending confirmation
- Failure
- Membership status mismatch

---

## M04 — Community and confidentiality agreement

### Purpose

Require acceptance of member conduct and reporting rules.

### Primary action

`Accept and continue`

### Required content

- respectful participation
- anonymity expectations
- prohibited confidential content
- no screenshots or restricted materials
- no personal information
- moderation rights
- report accuracy
- consequences for misuse

### States

- Not accepted
- Accepted
- Agreement version updated and re-acceptance required

---

## M05 — Onboarding: profile

### Purpose

Collect basic user context.

### Primary action

`Continue`

### Fields

- Education or career stage
- Opportunity type
- Target industries

### States

- Default
- Validation error
- Save failed
- Saved

---

## M06 — Onboarding: recruitment context

### Purpose

Collect current recruitment stage and urgency.

### Primary action

`Continue`

### Fields

- Target companies, optional
- Current recruitment stages
- Nearest important deadline
- Main preparation priorities

### States

- Default
- No deadline known
- Validation error
- Save failed

---

## M07 — Onboarding: confidence and support

### Purpose

Collect optional preferences for future recommendations.

### Primary action

`Finish onboarding`

### Fields

- Confidence areas
- Support needs
- Preferred learning format
- International student context, optional

### Secondary action

`Skip optional questions`

---

## M08 — Add first application prompt

### Purpose

Move the newly onboarded member into the core product loop.

### Primary action

`Add first application`

### Secondary action

`Go to dashboard`

### States

- No application
- Existing application already created in another flow

---

# 5. Core member screens

## D01 — Member dashboard

### Purpose

Provide compact access to active applications and useful workspace areas.

### Primary actions

- Browse preparation resources
- Add or update application
- Continue learning
- View relevant reports

### Required sections

- Active applications summary
- Upcoming deadlines
- Optional relevant suggestions
- Continue learning
- Relevant current reports
- Saved resources
- Contribution prompt

### States

- New member with no application
- Active applications with deadlines
- Active applications without deadlines
- No current recommendations
- No reports available
- All applications archived
- Loading error

### Access

Active member.

### Analytics

- dashboard viewed
- recommendation opened
- application opened
- learning resumed
- report opened

---

## A01 — Applications list

### Purpose

Show and manage all applications.

### Primary action

`Add application`

### Required controls

- Filter by status
- Sort by nearest deadline
- Show active or archived
- Search by company or role

### States

- No applications
- Active applications
- Only archived applications
- Loading error

---

## A02 — Add application

### Purpose

Create a tracked application.

### Primary action

`Save application`

### Fields

- Company
- Role
- Opportunity type
- Industry, optional
- Location
- Current stage
- Application deadline, optional
- Next-stage deadline, optional
- Notes, optional

### States

- Default
- Validation error
- Duplicate warning
- Save failure
- Save success

---

## A03 — Application detail

### Purpose

Show one application and connect it to preparation.

### Primary actions

- Update stage
- Edit application
- Open recommended resource
- View relevant reports

### Required sections

- Company and role
- Current stage
- Deadlines
- Notes
- Recommendations
- Related learning paths
- Relevant reports
- Activity history, simple version optional

### States

- Active
- Offer
- Rejected
- Withdrawn
- Archived
- Missing related content
- Loading error

---

## A04 — Edit application

### Purpose

Update application data.

### Primary action

`Save changes`

### Secondary actions

- Archive
- Delete, if supported
- Cancel

### States

- Default
- Validation error
- Concurrent update conflict, if applicable
- Save failure
- Archived
- Delete confirmation

---

## A05 — Update application stage

### Purpose

Provide a fast stage-change workflow.

### Primary action

`Update stage`

### Required information

- Current stage
- New stage
- New deadline, optional
- Outcome, if applicable

### Result

The application updates immediately; any optional suggestions are recalculated.

---

# 6. Learning screens

## L01 — Learning library

### Purpose

Allow members to browse and search preparation content.

### Primary action

`Open resource`

### Required controls

- Search
- Category filter
- Recruitment-stage filter
- Competency filter
- Content type filter
- Saved only
- Completed status

### States

- Default
- No search results
- No content in category
- Loading error

---

## L02 — Preparation Plan catalogue

### Purpose

Display optional structured Preparation Plans.

### Primary action

`Open plan`

### Useful information

- Title
- Outcome
- Short description
- Number of items, when decision-useful
- Status, when decision-useful
- Relevant stages

### States

- Not started
- In progress
- Completed
- No matching paths

---

## L03 — Learning path overview

### Purpose

Explain the path and display lessons.

### Primary action

`Start` or `Continue`

### Required sections

- Outcome
- Lesson sequence
- Compact status, when decision-useful
- Required or optional exercises
- Related resources

### States

- Not started
- In progress
- Completed
- Access denied
- Path unpublished

---

## L04 — Lesson page

### Purpose

Deliver one lesson.

### Primary action

`Mark complete and continue`

### Required content support

- Rich text
- Embedded video
- Examples
- Checklists
- Practice exercise
- Related links

### States

- Incomplete
- Completed
- Save progress failed
- Video unavailable
- Access denied

---

## L05 — Knowledge resource page

### Purpose

Deliver a standalone guide, checklist or framework.

### Primary actions

- Save
- Mark complete
- Open related content

### States

- Premium member access
- Public preview
- Access denied
- Resource unavailable

---

## L06 — Annotated coaching case

### Purpose

Teach through an anonymised before-and-after example.

### Primary action

`Try the practice prompt`

### Required sections

- Question
- Competency
- Original answer
- Coach observations
- Improvement questions
- Improved answer
- Why it is stronger
- Related resources

### States

- Default comparison view
- Original only before reveal, optional
- Access denied
- Case unpublished

---

## L07 — Saved resources

### Purpose

Show the member's bookmarked content.

### Primary action

`Open saved resource`

### States

- No saved resources
- Saved resources available
- Resource later unpublished

---

# 7. Recruitment report screens

## R01 — Recruitment reports search

### Purpose

Help members find recent candidate experiences.

### Primary action

`Open report`

### Search and filters

- Company
- Role
- Industry
- Location
- Stage
- Recruitment cycle
- Approximate date
- Confidence status

### States

- Results
- No exact results
- Suggested related results
- No current-cycle results
- Loading error

---

## R02 — Recruitment report detail

### Purpose

Present one moderated report.

### Primary actions

- View related reports
- View stage preparation
- Flag report

### Required sections

- Company
- Role
- Location
- Recruitment cycle
- Approximate date
- Stage
- Format
- Themes or competencies
- Candidate reflection
- Preparation advice
- Confidence label
- Publication date
- confidentiality notice

### States

- Published
- Historical
- Report removed
- Access denied

---

## R03 — Start report submission

### Purpose

Explain contribution expectations before the form.

### Primary action

`Start report`

### Required information

- What is useful
- What is prohibited
- How anonymity works
- How moderation works
- Possible contributor rewards

---

## R04 — Submit recruitment report

### Purpose

Collect a structured candidate experience.

### Primary action

`Review submission`

### Fields

- Company
- Role
- Industry
- Location
- Recruitment cycle
- Approximate date
- Stage
- Format
- Competencies or themes
- Candidate reflection
- Preparation advice
- Optional outcome
- Confidentiality confirmation

### States

- Draft
- Validation errors
- Autosave failed, if autosave exists
- Ready for review

---

## R05 — Review report submission

### Purpose

Allow the member to check the report before submission.

### Primary action

`Submit for moderation`

### Secondary action

`Edit`

### Required warnings

- Do not include restricted materials.
- Do not include personal information.
- Reports may be edited for clarity or safety.

---

## R06 — Submission confirmation

### Purpose

Confirm that the report entered moderation.

### Primary action

`View my submissions`

### Required information

- Submission status
- Expected next step, without promising a time
- Reward eligibility explanation

---

## R07 — My report submissions

### Purpose

Show the member's contribution history.

### Required states

- Draft
- Submitted
- In review
- Revision requested
- Approved
- Rejected
- Duplicate

### Primary actions

- Continue draft
- Edit requested revision
- View published report

---

## R08 — Revise report

### Purpose

Allow the contributor to respond to moderation feedback.

### Primary action

`Resubmit`

### Required information

- Moderator reason
- Fields requiring revision
- Original submission retained for audit

---

# 8. Community screens

## C01 — Community home

### Purpose

Provide focused member discussion without replacing structured reports.

### Primary action

`Create post`

### Required sections

- Categories
- Recent discussions
- Featured guidelines
- Report database link

### States

- Active community
- No posts
- Access denied
- External community handoff, if third-party platform used

---

## C02 — Community category

### Purpose

Browse discussions within a defined area.

### Primary action

`Create post`

### Example categories

- General recruitment
- Consulting
- Financial services
- Assessment centres
- International student support
- Accountability and progress

---

## C03 — Community post detail

### Purpose

Read and reply to a discussion.

### Primary action

`Reply`

### Secondary actions

- Report content
- Save or follow, optional

### States

- Open
- Locked
- Removed
- Reported
- Access denied

---

## C04 — Create community post

### Purpose

Start a focused discussion.

### Primary action

`Publish post`

### Fields

- Category
- Title
- Body

### Validation

Prompt users to submit recruitment experiences through the structured report form rather than ordinary posts.

---

# 9. Account and subscription screens

## U01 — Account overview

### Purpose

Manage personal account information.

### Primary actions

- Edit profile
- Manage membership
- Change password
- Communication preferences

---

## U02 — Edit profile and onboarding answers

### Purpose

Allow the member to update context used for recommendations.

### Primary action

`Save changes`

---

## U03 — Manage membership

### Purpose

Show current plan and billing status.

### Primary actions

- Manage payment method
- Cancel membership
- Reactivate, where supported

### Required information

- Plan
- Status
- Renewal date
- Access end date after cancellation
- Billing portal link

### States

- Active
- Past due
- Cancelled with access remaining
- Expired
- Pending

---

## U04 — Cancel membership

### Purpose

Allow self-service cancellation.

### Primary action

`Confirm cancellation`

### Required information

- Access end date
- What happens to saved data
- Reactivation option

### States

- Confirmation
- Success
- Failure

---

## U05 — Communication preferences

### Purpose

Control non-essential notifications.

### Controls

- Product updates
- Community digest
- New relevant reports
- Preparation reminders

Transactional account emails cannot be disabled where required.

---

# 10. Administrator screens

## AD01 — Admin dashboard

### Purpose

Show operational priorities.

### Required widgets

- Reports awaiting moderation
- Community flags
- New users
- Active memberships
- Recently published content
- Basic funnel metrics
- System notices

---

## AD02 — Content list

### Purpose

Manage knowledge resources.

### Primary action

`Create content`

### Filters

- Type
- Category
- Status
- Author
- Updated date

### Bulk actions

Use cautiously; publish/unpublish only if auditable.

---

## AD03 — Content editor

### Purpose

Create or edit a knowledge resource.

### Required capabilities

- Title
- Slug
- Summary
- Rich content
- Video embed
- Categories
- Tags
- Access level
- Related content
- Publication state
- Preview

---

## AD04 — Learning path list

### Purpose

Manage learning paths and status.

---

## AD05 — Learning path editor

### Purpose

Create and order lessons.

### Required capabilities

- Outcome
- Description
- Relevant stages
- Lesson order
- Publication state

---

## AD06 — Coaching case list

### Purpose

Manage annotated examples.

---

## AD07 — Coaching case editor

### Purpose

Create anonymised coaching cases.

### Required safeguards

- Personal information warning
- Required anonymisation confirmation
- Preview
- Publication workflow

---

## AD08 — Recruitment report moderation queue

### Purpose

Review pending reports efficiently.

### Primary actions

- Approve
- Approve with edits
- Request revision
- Reject
- Mark duplicate
- Escalate

### Required filters

- Company
- Stage
- Submitted date
- Risk flag
- Status

---

## AD09 — Recruitment report moderation detail

### Purpose

Inspect one submission and record a decision.

### Required sections

- Submitted fields
- confidentiality confirmation
- automated warnings, if any
- similar existing reports
- moderation notes
- audit history

### Required actions

- Edit public wording without altering material meaning
- approve
- request revision
- reject
- remove prohibited details
- assign confidence status
- grant contributor reward

---

## AD10 — Published recruitment reports

### Purpose

Manage live reports.

### Actions

- Edit
- Unpublish
- Remove
- Change confidence label
- Link related reports

---

## AD11 — Community moderation queue

### Purpose

Handle reported posts and comments.

### Actions

- Dismiss report
- Remove content
- Lock discussion
- Warn or restrict member, if supported
- record moderator note

---

## AD12 — Recommendation rules list

### Purpose

Manage rule-based mappings between application context and resources.

### Required fields

- Trigger stage
- Deadline window
- Optional industry
- Optional opportunity type
- Recommended resource
- Priority
- Active status

---

## AD13 — Recommendation rule editor

### Purpose

Create or update a mapping.

### Required validation

- no invalid content reference
- no duplicate priority conflict without warning
- clear effective status

---

## AD14 — User list

### Purpose

Search and inspect users.

### Required information

- Email
- Registration date
- Verification status
- Membership status
- Community status
- Report contribution count

Sensitive application data should not be shown by default.

---

## AD15 — User detail

### Purpose

Support account and moderation operations.

### Actions

- View membership status
- resend verification, if appropriate
- suspend community access
- inspect report history
- view audit events
- avoid impersonation unless explicitly designed and secured

---

## AD16 — Membership list

### Purpose

Review billing and access status.

### Required states

- Active
- Pending
- Past due
- Cancelled
- Expired

---

## AD17 — Categories and tags

### Purpose

Manage taxonomy across learning and reports.

### Actions

- Create
- Rename
- Merge
- Archive

Destructive taxonomy changes should show impact before confirmation.

---

## AD18 — Basic analytics

### Purpose

Review MVP validation metrics.

### Required metrics

- Landing-to-registration conversion
- Registration-to-paid conversion
- Onboarding completion
- First application added
- Learning path started and completed
- Recruitment reports viewed and submitted
- Weekly active members
- Cancellation

---

## AD19 — Audit log

### Purpose

Track important administrative actions.

### Events

- Publish/unpublish content
- Moderate report
- Grant reward
- Change membership access
- Remove community content
- Change recommendation rule

---

# 11. Shared system screens and states

## S01 — Access denied

Used when the user lacks required membership or role.

Actions:

- Join
- Manage membership
- Return to dashboard

---

## S02 — Not found

Used for invalid or removed resources.

Actions:

- Return to dashboard
- Search library

---

## S03 — Generic system error

Requirements:

- plain-language message
- retry action
- support path
- correlation identifier for internal diagnosis, if appropriate
- no sensitive technical details

---

## S04 — Maintenance or temporary unavailability

Requirements:

- explain temporary unavailability
- preserve trust
- avoid promising an exact restoration time unless known

---

## S05 — Membership required

Used for premium content previews.

Actions:

- View membership
- Return to free content

---

# 12. MVP screen priorities

## Must exist for the first production MVP

- P01 Landing page
- P03 Membership and pricing
- P05 Sign in
- P06 Create account
- P07 Verify email
- P08 Password reset request
- P09 Set new password
- M01 Choose membership
- M02 Checkout
- M03 Payment result
- M04 Community agreement
- M05–M07 Onboarding
- M08 Add first application prompt
- D01 Dashboard
- A01–A05 Applications
- L01–L06 Learning
- R01–R08 Recruitment reports
- U01–U04 Account and membership
- AD01–AD15 Core administration
- S01–S05 Shared states

## May use an external service initially

- C01–C04 Community discussion
- Parts of U03 billing management
- Payment checkout
- Video delivery
- Analytics dashboards

## Can wait until after the first closed beta

- Advanced saved-resource management
- Communication preference centre
- Detailed audit-log viewer
- Advanced taxonomy merging
- sophisticated community following
- advanced application history
- recommendation explanations
- bulk administration tools

---

# 13. Screen-level quality rules

Every screen must:

1. Work on mobile and desktop.
2. Have one clear primary action.
3. Include loading, empty, error and success states where relevant.
4. Meet basic keyboard-accessibility expectations.
5. Avoid exposing member-private data.
6. Use plain language.
7. Track only necessary analytics.
8. Handle inactive membership correctly.
9. Preserve unsaved form data where practical.
10. Clearly distinguish community claims from OfferLab-authored guidance.

---

# 14. Open UX decisions

The following should be resolved during low-fidelity wireframing:

1. Whether the dashboard is organised primarily by application or by urgent task.
2. Whether onboarding creates the first application inline.
3. Whether learning paths and standalone resources share one catalogue.
4. How much of a premium resource is visible before membership.
5. Whether reports show exact dates or month/year only.
6. How contributor confidence labels are explained.
7. Whether report forms support drafts in the first release.
8. Whether the member community is native or external.
9. Whether users can permanently delete applications or only archive them.
10. Which administrator roles are required beyond a single admin role.
