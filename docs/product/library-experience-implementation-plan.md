# Library experience implementation plan

**Status:** Founder-approved implementation direction

**Approved:** 2026-08-21

**Objective:** Make Library useful before asking a member to classify or
structure information. Reduce form filling, increase production-quality
content, and connect guidance directly to member-owned applications, answers,
stories and practice.

**Authority:** This plan defines UX and delivery sequencing within the current
product boundary. It does not approve a generic chatbot, silent AI edits,
automatic publication, marketplace infrastructure or unreviewed production AI.
Founder Decisions and the current product contract retain precedence.

## Product principle

The primary loop is:

```text
Find relevant guidance
        ↓
Create one useful artefact
        ↓
Review or practise it
        ↓
Reuse it in an application
```

Members should capture information once and improve it progressively. OfferLab
must derive or prefill controlled context that it already knows instead of
asking the member to enter it again.

## Current problems

- Library exposes too many equal-weight destinations.
- Answer Bank appears both as primary product navigation and as Library
  navigation.
- Coaching Cases, Resources and Preparation Plans behave like separate products
  rather than different ways to use preparation content.
- Story creation initially asks for title, experience type, six narrative
  sections, competencies and readiness.
- Answer creation exposes question source, family, label, application, stage,
  key points, draft, linked stories, ordering and readiness together.
- Recruitment Intelligence submission asks for extensive classification before
  the member has captured the useful experience.
- resource discovery uses a large submit-based filter form;
- practice value depends too heavily on scheduled rooms even though a large
  case library exists;
- empty or thin destinations receive primary navigation weight.

## Target information architecture

Library navigation should contain at most:

1. **Library** — resources, coaching cases and optional Preparation Plans;
2. **Practice** — solo cases, Group Mock and bounded feedback;
3. **Intelligence** — browse and contribute moderated recruitment reports.

Answer Bank remains a primary workspace destination and should not compete as a
Library sub-navigation tab. Existing URLs may redirect for compatibility.

Inside Library, lead with user intent:

- Interview answers;
- Assessment centre;
- Applications and written exercises;
- Commercial awareness;
- Workplace and professional communication.

Content type, category, tag and completion status remain secondary filters.
Preparation Plans are optional curated collections, not a required journey.

## UX-01 — Library home

Replace the catalogue-of-destinations overview with:

1. one **Continue** item when the member has unfinished work;
2. **Prepare for an application** using an existing application or saved job;
3. intent-based entry cards;
4. a small founder-reviewed featured collection;
5. saved and recently used content;
6. full browse/search as a secondary destination.

Do not show unavailable rooms, unpublished cases or empty collections as
primary calls to action. Empty states should offer a useful adjacent action.

## UX-02 — Quick Story capture

The initial Story creation state contains:

- title;
- one large prompt: “What happened?”;
- Save.

After first save, show optional progressive structure:

- Situation;
- what needed to be achieved;
- Actions;
- Reasoning;
- Result;
- Reflection.

Requirements:

- draft saving never requires every structured section;
- content autosaves after the first explicit creation;
- the original capture remains recoverable;
- members may move or copy text into structured sections;
- competencies are suggestions after evidence exists, not initial required
  classification;
- “Ready” remains explicit and requires the existing truthful completeness
  rules;
- deterministic section suggestions precede any hosted-AI proposal;
- no suggestion silently changes source text.

Target: the first reusable Story is saved in under 60 seconds.

## UX-03 — Direct answer editor

Selecting a curated question opens directly into one focused answer editor.

Automatically derive:

- question family from the controlled question;
- answer label from its prompt;
- recruitment stage from a selected current application where available;
- company and role from that application;
- relevant existing stories from controlled competency and stage metadata.

Initially display only:

- the question;
- answer editor;
- Save draft;
- Review answer when eligible.

Application context, key points, linked-story ordering, metadata, readiness and
archive controls are progressive secondary sections. Drafts autosave after
creation. The member can still explicitly save a version and mark it ready.

Target: a member begins a first answer in one click from a question and can save
it within two minutes.

## UX-04 — Simplified Intelligence contribution

Begin with:

- existing application or employer;
- recruitment stage and approximate date;
- “What happened?”;
- “What should another candidate know?”

Prefill company, role, opportunity type and industry from canonical application
or employer context. Derive recruitment cycle from the approximate date. After
capture, offer reviewable suggestions for format, general themes and assessed
skills.

Requirements:

- draft save and resume;
- optional fields do not block draft creation;
- confidentiality confirmation is required only at final submission;
- final submission still validates safety, provenance and moderation fields;
- no report becomes public without administrator moderation;
- no exact restricted question, personal data or confidential material is
  encouraged or generated.

## UX-05 — Immediate resource discovery

- prominent search;
- intent and stage chips;
- “For my current application”;
- Saved;
- Recently used;
- immediate URL-backed filtering without an Apply button;
- category, tag, opportunity type and completion remain behind advanced filters;
- active filters are individually removable;
- mobile filters open in a compact accessible sheet or disclosure;
- query and filter state remains shareable and noindex where appropriate.

When no exact result exists, offer one or more of:

- adjacent stages;
- the general stage playbook;
- request coverage;
- save the search;
- opt-in notification when moderated content is published.

## UX-06 — Application preparation bundle

Add **Prepare for this application** to application detail and relevant saved
job/employer surfaces.

The deterministic preparation bundle may contain:

- stage-relevant curated questions;
- Story Bank evidence gaps;
- a stage checklist;
- relevant coaching cases;
- employer Recruitment Intelligence;
- one suitable practice case;
- deadline context.

This is a projection over current controlled data, not a generated curriculum,
match score or prediction. Members can use any item directly and ignore the
rest. No forced completion sequence or large dashboard is introduced.

## UX-07 — Solo practice

Make existing practice cases useful without a scheduled room:

1. choose or open a contextually relevant case;
2. optionally start a timer;
3. record private notes;
4. reveal assessment criteria and facilitation prompts;
5. inspect structured reasoning, not a single “correct” answer;
6. save a reflection;
7. optionally create a Story Bank draft from that reflection.

Live Group Mock remains a separate, higher-value experience. Rules acceptance is
stored against its terms version; repeat booking becomes one click until the
terms version changes.

## UX-08 — Actionable content

Every published item must offer one relevant next action:

- Use this question;
- Start an answer;
- Add this checklist to an application;
- Practise this case;
- Save a reflection as a Story;
- View relevant employer reports.

Content metadata must not dominate the reading experience. Show provenance,
review date, estimated use time and the primary action clearly.

## Editorial minimum

Publish a deliberately small, professionally reviewed core before expanding
catalogue volume:

- all 14 core questions, each with:
  - what is being assessed;
  - a useful response structure;
  - common weak patterns;
  - one annotated fictional example;
  - evidence-finding prompts;
- 8–12 stage playbooks covering application, online tests, video interview,
  assessment centre, final interview and offer decisions;
- 8–10 fully annotated coaching cases across competency, motivation,
  commercial-awareness and situational questions;
- 20–30 concise checklists and exercises;
- solo-practice versions of the strongest existing Group Mock cases;
- a small founder-reviewed set of cycle-dated Intelligence reports across
  multiple employers and stages.

Each content item should provide:

1. a two-minute summary;
2. a concrete example;
3. a checklist or exercise;
4. one workspace action;
5. honest provenance and last-reviewed information.

Do not use catalogue size as the quality target. Content remains draft until
founder/editor review and the existing publication rules pass.

## Delivery sequence

### Library P0 — remove creation friction

1. simplify Library navigation;
2. add Quick Story capture and progressive structure;
3. open curated questions directly in the focused answer editor;
4. add autosave and recovery for long-form drafts;
5. prefill known context from applications, saved jobs and employers;
6. hide optional metadata until requested;
7. remove unavailable or empty destinations from primary calls to action;
8. publish the first founder-reviewed content pack.

### Library P1 — connect preparation

1. application preparation bundles;
2. solo practice for existing cases;
3. conversion between reflection, Story and answer;
4. simplified Intelligence draft/submission;
5. immediate resource filters and contextual search;
6. cross-links from applications, jobs and employers;
7. versioned first-time practice-rules acceptance.

### Library P2 — bounded assistance

1. deterministic Story-section suggestions;
2. reviewable competency suggestions;
3. relevant existing Story suggestions for answers;
4. Intelligence metadata suggestions;
5. transparent content recommendations from application stage and saved
   employers.

Hosted-model assistance remains blocked until the production AI gates pass.
Every suggestion is reviewable and preserves the member's source record.

## Accessibility and responsive requirements

- no horizontal navigation or form overflow at 390 CSS pixels;
- keyboard and screen-reader access to filters, disclosures and editors;
- autosave state announced without stealing focus;
- errors remain linked to the relevant field;
- progressive sections retain logical heading order;
- touch targets meet the design-system minimum;
- mobile editors keep the primary save/review action reachable;
- reduced motion is respected;
- intent, readiness and completion never rely on colour alone.

## Acceptance measures

- first Story saved in under 60 seconds in moderated usability testing;
- first answer draft started with one action from a curated question;
- no more than three visible inputs in any initial creation state;
- optional metadata never blocks draft saving;
- all long-form member drafting autosaves after explicit record creation;
- known application/employer context is not requested again;
- every published resource has a direct workspace action;
- solo practice works without a scheduled room;
- members can resume unfinished Library work from one clear location;
- desktop and mobile browser tests cover the complete core flows;
- owner scoping, forced RLS, version conflicts and archival behavior remain
  unchanged or become stricter.

## Non-goals

- a mandatory course or wizard;
- completion gamification, streaks or arbitrary targets;
- a generic AI chat surface;
- silent rewriting or automatic source-record mutation;
- match probabilities or hiring predictions;
- automatic Intelligence publication;
- replacing curated content with generated filler;
- weakening Story, Answer, application or document privacy;
- building a marketplace or automatic practice matching.

## Definition of done

This programme is complete when:

1. Library P0 and P1 acceptance measures pass at desktop and mobile widths;
2. the founder-reviewed editorial minimum is available or unavailable
   destinations are not promoted;
3. members can move from guidance to a saved artefact without re-entering known
   context;
4. no long form must be completed in one session;
5. application, job and employer context lead naturally into preparation;
6. privacy, RLS, moderation and provenance tests remain green;
7. hosted AI remains behind its independent production approval gates.
