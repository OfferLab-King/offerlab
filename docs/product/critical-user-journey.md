# OfferLab Critical User Journey

**Document version:** 0.1  
**Status:** Draft for architecture review  
**Primary owner:** Founder / Product  
**Related source of truth:** `mvp-brief.md`

---

## 1. Purpose

This document defines the primary end-to-end journey that the OfferLab MVP must support.

It is intentionally focused on one core outcome:

> A graduate applicant joins OfferLab, records an active application, receives stage-relevant preparation guidance, uses premium learning resources, reads current community intelligence, and later contributes a structured recruitment report.

This journey should guide:

- UX design
- architecture decisions
- data modelling
- backlog creation
- analytics
- testing
- first-release acceptance

The MVP should not optimise for every possible user journey. It should make this journey clear, reliable and valuable.

---

## 2. Primary user

### Persona

A UK university student or recent graduate applying for internships or graduate schemes.

### Typical context

- They are applying to several employers.
- They have an upcoming deadline, test, interview or assessment centre.
- Their preparation is scattered across notes, YouTube, ChatGPT, group chats and company websites.
- They are unsure what to prepare next.
- They want current information from candidates who have recently experienced the process.
- They may have useful examples but struggle to explain them effectively.
- They are willing to pay for structure, confidence and time savings.

---

## 3. Core user goal

> Help me understand what I should prepare next for a specific application and give me the right resources, examples and current candidate insights to prepare effectively.

---

## 4. Journey overview

```text
Discover OfferLab
    ↓
Understand the value proposition
    ↓
Create account
    ↓
Purchase membership
    ↓
Accept community and confidentiality rules
    ↓
Complete onboarding
    ↓
Add first application
    ↓
Receive stage-based recommendations
    ↓
Open a relevant learning path
    ↓
Study an annotated coaching case
    ↓
Read relevant recruitment reports
    ↓
Return and update application progress
    ↓
Submit a structured recruitment report
    ↓
Receive moderation outcome and contributor reward
```

---

## 5. Journey stages

## Stage 1: Discovery

### User situation

The user encounters OfferLab through:

- YouTube
- Xiaohongshu
- search
- referral
- a student society
- an existing coaching relationship

### User question

> Is this relevant to the application problem I have now?

### Required product response

Public content should solve one specific problem and demonstrate the OfferLab methodology.

Example public topic:

> Three mistakes candidates make in assessment-centre group exercises.

The call to action should direct the user to OfferLab for:

- structured preparation
- current candidate reports
- annotated examples
- application tracking
- progress guidance

### Success condition

The user visits the OfferLab landing page with a clear reason to explore membership.

---

## Stage 2: Landing page

### User question

> Why should I pay for OfferLab instead of using free videos, ChatGPT or public forums?

### Required information

The landing page must explain:

1. Who OfferLab is for.
2. What problem it solves.
3. What members receive.
4. How current recruitment reports work.
5. What makes the platform different from generic content.
6. Membership options.
7. Trust, moderation and confidentiality principles.
8. A clear action to join.

### Primary action

`Join OfferLab`

### Secondary action

`Explore how it works`

### Success condition

The user understands the product promise and starts registration.

---

## Stage 3: Account creation

### User actions

1. Enter email.
2. Create password or use an approved authentication provider.
3. Verify email.
4. Accept terms and privacy notice.

### Product requirements

- Registration must be mobile-friendly.
- Validation messages must be clear.
- Existing accounts must be recognised.
- Failed verification must have a recovery path.
- The user should not have access to premium content before membership is active.

### Success condition

A verified account exists.

---

## Stage 4: Membership purchase

### User question

> Which option fits my recruitment period?

### Initial pricing hypothesis

- Monthly membership
- Recruitment-season membership

### User actions

1. Select a plan.
2. Enter payment details.
3. Complete payment.
4. Receive confirmation.

### Product requirements

- Successful payment activates membership.
- Failed payment does not grant access.
- The user can retry a failed payment.
- Cancellation terms are clear.
- Membership status is stored reliably.
- The user receives a receipt or confirmation email.

### Success condition

The user becomes an active member and can begin onboarding.

---

## Stage 5: Community and confidentiality agreement

### User actions

The user reviews and accepts rules covering:

- respectful participation
- member anonymity
- prohibited confidential material
- no employer-platform screenshots
- no personal information about interviewers or candidates
- no misleading or fabricated reports
- moderation rights
- contribution standards

### Success condition

The user explicitly accepts the rules before accessing community features or submitting reports.

---

## Stage 6: Onboarding

### User question

> How can OfferLab understand what I need?

### Required questions

#### Essential

- Current education or career stage
- Graduate role, internship or both
- Target industries
- Current recruitment stages
- Nearest important deadline
- Main preparation priorities

#### Optional

- Target companies
- Confidence areas
- Support needs
- International student status
- Preferred learning format

### Product behaviour

- Onboarding should take less than five minutes.
- Non-essential questions can be skipped.
- Progress should be visible.
- Answers should be editable later.
- Recommendations should be rule-based in the MVP.
- The user should be prompted to add an application immediately afterwards.

### Success condition

The platform has enough information to personalise the initial dashboard.

---

## Stage 7: Add first application

### User question

> What information do I need to record?

### Required fields

- Company
- Role
- Opportunity type
- Location
- Current stage
- Application deadline, if known
- Next-stage deadline, if known
- Personal notes, optional

### Initial stage values

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

### Product behaviour

- The form should take less than two minutes.
- Company entry may support suggestions but must allow manual input.
- Deadline fields must be optional because users may not know them.
- The user must be able to edit the application later.
- The user must not see another member's application data.

### Success condition

The first active application is saved and appears on the dashboard.

---

## Stage 8: Stage-based dashboard guidance

### User question

> What should I do next?

### Dashboard sections

1. Active applications
2. Upcoming deadlines
3. Recommended preparation
4. Continue learning
5. Relevant recruitment reports
6. Saved resources
7. Contribution prompt, when appropriate

### Rule example

```text
Application stage: Video interview
Deadline: Within 7 days

Recommend:
- Video interview preparation path
- Motivation question guide
- Teamwork example guide
- Recording checklist
- Recent reports for the company and role
```

### Recommendation principles

- Deadline urgency should affect prominence.
- Current stage should determine the main preparation category.
- Existing progress should prevent repeatedly recommending completed items.
- Missing data should result in helpful prompts, not errors.
- The MVP should not require generative AI.
- Recommendation rules should be documented and testable.

### Success condition

The user can identify at least one relevant next action without searching manually.

---

## Stage 9: Open a learning path

### User question

> Can this prepare me for the task I face now?

### Learning path components

- Clear outcome
- Short lessons
- Framework
- Examples
- Common mistakes
- Video demonstration where useful
- Practical exercise
- Reflection or checklist
- Completion state
- Related resources

### Example path

`Preparing for a video interview`

Possible lessons:

1. Understand how recorded interviews are assessed.
2. Prepare motivation answers.
3. Build concise competency examples.
4. Improve camera, timing and delivery.
5. Complete a timed practice.
6. Review the final checklist.

### Product behaviour

- Progress is saved automatically.
- The user can leave and return.
- The next lesson is clearly identified.
- Completed paths should influence future recommendations.
- Premium content must remain protected.

### Success condition

The user completes at least one meaningful lesson and knows the next step.

---

## Stage 10: Review an annotated coaching case

### User question

> What does a weak answer look like, and why is the improved version stronger?

### Case structure

1. Interview question
2. Competency being assessed
3. Anonymised original answer
4. Key weaknesses
5. Coach observations
6. Questions asked during coaching
7. Improved version
8. Explanation of changes
9. Practice prompt
10. Related content

### Product behaviour

- Original and improved versions should be easy to compare.
- Identifying information must not be included.
- The reasoning should be more prominent than the final answer.
- Cases should be tagged by competency, stage and industry where relevant.

### Success condition

The user understands at least one concrete improvement they can apply to their own answer.

---

## Stage 11: Read recruitment reports

### User question

> What have candidates experienced recently for this company, role and stage?

### Search and filter options

- Company
- Role
- Industry
- Location
- Recruitment stage
- Recruitment cycle
- Approximate date
- Confidence or verification status

### Report content

- Company
- Role
- Location
- Recruitment cycle
- Approximate attendance date
- Stage
- Format
- General competencies or themes
- Candidate reflection
- Preparation advice
- Confidence label
- Publication date

### Product behaviour

- Current-cycle reports should be prioritised.
- Historical reports must be clearly labelled.
- Member identity must not be publicly displayed.
- Users should be able to report inappropriate content.
- Exact prohibited or confidential materials should not be displayed.

### Success condition

The user finds at least one relevant report or receives a clear empty state explaining how to prepare without one.

---

## Stage 12: Return and update progress

### Return triggers

- Upcoming deadline
- New report for a tracked company
- Incomplete learning path
- Application stage change
- Report moderation outcome
- Manual habit or reminder

### User actions

- Update application stage
- Change deadlines
- Continue learning
- Read new reports
- Save resources
- archive completed applications

### Product behaviour

- The dashboard should reflect the updated stage immediately.
- Recommendations should change according to the new stage.
- Offer, rejection and withdrawal outcomes should be recordable without deleting history.
- Archived applications should be accessible but not dominate the active view.

### Success condition

The user has a reason to return beyond a single content view.

---

## Stage 13: Submit a recruitment report

### Trigger

After attending an online test, interview or assessment centre, the user is prompted to contribute.

### Required report fields

- Company
- Role
- Industry
- Location
- Recruitment cycle
- Approximate date
- Recruitment stage
- Format
- Competencies or themes
- Personal reflection
- Preparation advice
- Optional outcome
- Confidentiality confirmation

### Product behaviour

- The report is private until approved.
- The user can preview before submission.
- Personal identity is not shown publicly.
- Low-value, duplicate or prohibited content can be rejected.
- The moderation status is visible to the contributor.
- The user can receive a request for revision.

### Success condition

A complete report enters the moderation queue.

---

## Stage 14: Moderation outcome and contributor reward

### Possible outcomes

- Approved
- Approved with edits
- Revision requested
- Rejected
- Duplicate
- Prohibited content

### User communication

The user receives:

- outcome
- brief reason
- next action, if any
- contributor reward, if earned

### Initial reward options

- membership extension
- future Group Mock credit
- future AI feedback credit
- contributor badge
- access to selected premium resources

### Success condition

The user understands the decision and sees that useful contribution is recognised.

---

## 6. Critical empty states

The MVP must deliberately design the following empty states.

### No applications

Message:

> Add your first application so OfferLab can recommend what to prepare next.

Primary action:

`Add application`

### No relevant recruitment reports

Message:

> No current report is available for this exact company and stage yet. Use the recommended stage preparation while the community database grows.

Actions:

- View stage preparation
- Browse related company reports
- Contribute after attending

### No learning progress

Message:

> Start with the path most relevant to your nearest deadline.

### No upcoming deadlines

Message:

> Add a deadline or update an application stage to receive more specific guidance.

### No community activity

Message:

> Start a focused discussion or browse structured recruitment reports.

---

## 7. Critical error and recovery states

The MVP must support clear recovery for:

- account already exists
- email verification expired
- payment failed
- membership status delayed
- onboarding save failed
- application save failed
- invalid deadline
- content unavailable
- report submission failed
- session expired
- unauthorised access
- report rejected or returned for revision

Errors should:

- explain what happened in plain language
- preserve user-entered data where possible
- provide a clear next action
- avoid exposing technical details
- be logged for diagnosis

---

## 8. Analytics events for the journey

At minimum, track:

- `landing_page_viewed`
- `join_clicked`
- `registration_started`
- `registration_completed`
- `membership_checkout_started`
- `membership_activated`
- `onboarding_started`
- `onboarding_completed`
- `application_created`
- `application_stage_updated`
- `recommendation_opened`
- `learning_path_started`
- `learning_lesson_completed`
- `learning_path_completed`
- `annotated_case_viewed`
- `recruitment_report_searched`
- `recruitment_report_viewed`
- `recruitment_report_started`
- `recruitment_report_submitted`
- `recruitment_report_approved`
- `recruitment_report_revision_requested`
- `recruitment_report_rejected`
- `subscription_cancelled`

Sensitive free-text notes must not be sent to analytics providers.

---

## 9. Journey acceptance criteria

The critical journey is accepted when a realistic test user can:

1. Create and verify an account.
2. Purchase or receive an active test membership.
3. Accept community rules.
4. Complete onboarding in under five minutes.
5. Add an application in under two minutes.
6. See a recommendation determined by application stage.
7. Start and resume a learning path.
8. View an annotated coaching case.
9. search and read a relevant recruitment report.
10. Update the application's stage and see new recommendations.
11. Submit a structured recruitment report.
12. See the moderation status.
13. Receive a moderation outcome.
14. Cancel membership without founder intervention.

The journey must work on both desktop and mobile web.

---

## 10. Explicit exclusions

This journey does not include:

- mentor marketplace
- live mentor scheduling
- automated Group Mock matching
- volunteering marketplace
- experience programmes
- native mobile application
- unrestricted AI chat
- complex employer accounts
- university administration
- multi-currency billing
- automatic cash refunds for reports

---

## 11. Product decisions still open

The architecture and design process may need to resolve:

1. Whether payment occurs before or after onboarding.
2. Whether the basic community uses an external platform or native implementation.
3. Whether company names come from a controlled directory or free text initially.
4. Whether recommendation rules are managed through the admin interface in the first release.
5. Whether deadline reminders are included in the first production release.
6. Whether report revision happens through an editable submission or a new submission.
7. Which membership plan is used for the first closed beta.

Open decisions must be documented before implementation if they materially affect architecture or user behaviour.
