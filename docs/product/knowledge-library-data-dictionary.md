# Knowledge library data dictionary

## Purpose and identity

The library is OfferLab's searchable preparation workspace. `app.preparation_resource` is the canonical standalone resource and deterministic-recommendation target; there is no competing knowledge-resource identity. Stable `resource_key` values survive editorial changes. Recommendation state and resource save/completion are independent.

Seed bodies prove the journey and are starter content requiring editorial review before production launch.

## Resource and lifecycle

Each resource has an internal UUID, stable key, globally unique slug, title (160), summary (500), controlled type/access/state, Markdown body (100,000), active primary category, optional minutes (1–600), optional validated YouTube ID, database-controlled positive version, and timestamps. Types are `guide`, `checklist`, `template`, `video`, `exercise`, and `article`. Access is `public` or `member`; state is `draft`, `published`, or `archived`.

Creation starts in draft and may omit title, summary, body and category while editorial work is incomplete; it always requires a valid stable slug and controlled type/access values. Publish and republish authoritatively require a title, summary, non-empty safe Markdown body, active category, active tags, valid associations, controlled links, video configuration and controlled values. Publish, unpublish to draft, archive, and restore to draft preserve associations and member state. `first_published_at` makes the slug immutable after first publication. Related resources are directional, administrator-ordered, non-self, duplicate-free and limited to 20. Unavailable targets remain visible to administrators but are excluded from public/member reads. Controlled links are ordered and limited to 20, use `download`, `external`, or `template_copy`, and require HTTPS or a same-origin relative path; protocol-relative, credential-bearing and obfuscated script/data/file destinations are rejected, and the server never fetches them.

## Taxonomy and applicability

Every published resource has one active administrator-managed category. Category and tag names and stable slugs are case-insensitively unique. Categories/tags are archived, not deleted, and existing associations remain durable. Archiving a category or tag transactionally returns affected published resources to draft and audits those unpublishes; restoring taxonomy does not republish content. Archived categories cannot satisfy publication. Archived tags cannot be newly assigned or satisfy publication, although an existing draft association stays visible until removed or restored. Stage keys reuse application stages and opportunity keys reuse Founder Decisions. No duplicate taxonomy exists.

## Markdown and video safety

Markdown is NFC/LF normalized and rendered by `react-markdown` with GFM and no raw-HTML support. Script, iframe, object, embed, form, handler and style HTML is not interpreted. Links are limited to relative same-origin and HTTP(S); unsafe schemes become text. External links use `noopener noreferrer`. YouTube uses a separately validated ID and controlled youtube-nocookie.com iframe without autoplay.

## Member state, privacy and audit

`app.member_resource_state` has one owner/resource row with independent optional saved/completed timestamps. It stores no Auth UUID, email, application content, search term, recommendation explanation, body or labels. Unpublish/archive preserves it. Owner-scoped repositories and forced RLS require the internal UUID; administrators have no ownership bypass.

Meaningful actions atomically audit `resource.saved`, `resource.unsaved`, `resource.completed`, or `resource.marked_incomplete` with metadata `{}`. Property-free analytics occurs after commit only. Failures/unchanged actions emit neither. Logs redact content and state; payloads must not be logged.

## Search, access and caching

`/member/learn` uses controlled URL parameters, indexed PostgreSQL full-text search, filters and 12-item pages. Search covers title, summary and body; order is title then UUID. Queries are NFC/whitespace normalized, control-character rejected and capped at 120. Search terms never enter logs, audit or analytics.

`/member/learn/[slug]` requires authentication, verification, entitlement and completed onboarding. `/learn/[slug]` returns only published public content. Both share readers/rendering. Member/admin/preview responses are private and dynamic; public resources are deliberately dynamic so unpublish/archive cannot leave stale content.

## Administration and concurrency

The `/admin/content` routes use the established verified administrator role. Administrators manage resources, categories, tags, controlled links and ordered associations without permanent deletion. The administrator's visual canvas remains private and uses the same renderer as public and member routes. Its structured edit panel updates that canvas live; it does not mutate the source record until an explicit form action succeeds. Saving a published resource updates the canonical record read by members, while saving an unpublished resource remains private. Versions/timestamps are database controlled; edits require expected version and stale writes produce only a generic reload conflict. A normalized save that changes no scalar, lifecycle value, association membership or ordering returns `unchanged`, preserves version/timestamps and creates no audit or analytics event. One logical save increments the resource version once and writes one primary audit in the same transaction; audit failure rolls back the mutation. Browser roles and identity-sync have no content or member-state table access. Runtime operations remain behind forced RLS and transaction-local internal-user context.

CMS mutations retain Next.js Server Actions for Increment 5. The accepted framework boundary and possible future Route Handler hardening are documented in [Deferred Improvement: CMS Mutation Transport Hardening](../architecture/deferred-cms-transport-hardening.md); this deferred transport redesign is not an Increment 5 blocker.

## Recommendation availability and state independence

Deterministic rules retain their stable keys, versions, precedence, urgency and limits. A bounded persisted-catalogue query verifies that each expected stable resource key and slug is present, published, unarchived and in an active category before it is returned. Missing, renamed, draft, unpublished or archived targets are excluded without exposing their copy. Recommendation completion/dismissal/restoration and resource save/completion are separate state machines; neither transition changes the other.

## Acceptance coverage and cache behavior

Public, member and administrator pages are dynamic. Member state and previews are private, state API responses use `private, no-store`, and shared output never includes owner state. Public reads re-check publication, access and active-category status on each request, so unpublish, archive or taxonomy archive has no stale application-cache window.

Unit coverage exercises normalization, strict inputs, rendered Markdown and hostile URL schemes. Production-equivalent PostgreSQL integration coverage exercises draft/publish/no-op/conflict behavior, transactional audit counts, taxonomy archive safety, forced RLS, least-privilege roles and two-owner state isolation. Recommendation regression coverage verifies persisted target availability and resource-state independence. Browser coverage owns completed-member, anonymous-public and administrator journeys at desktop and mobile widths. Starter coaching bodies remain synthetic editorial fixtures and are not founder-approved production copy.

Learning paths reference canonical resources and derive progress from this same completion state; see [Learning paths data dictionary](learning-paths-data-dictionary.md). Annotated coaching cases remain deferred.
