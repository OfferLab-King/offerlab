# Learning paths data dictionary

## Purpose

Preparation Plans are optional structured checklists for members who want broader stage-specific preparation, alongside direct Knowledge Library exploration. Members may search, filter, save, open and complete any accessible canonical `preparation_resource` in any order. Plans reference those records; they never copy resource titles, bodies, videos or completion state, and they are not required navigation for Applications, Answer Bank or Resources.

## Model and lifecycle

`learning_path` owns a stable key and slug, editorial metadata, optional active primary category, positive database-controlled version and `draft`, `published` or `archived` lifecycle. The slug locks after first publication. Ordered `learning_path_section` rows contain ordered `learning_path_item` references. A unique database index prevents a resource appearing twice in one path. `member_learning_path_state` records only an owner's optional following state; archive and unpublish preserve it. Five synthetic starter drafts are seeded and require founder editorial review before publication.

Drafts may be incomplete. Publication requires complete metadata, non-empty sections, unique items, and existing published resources in active categories. Unpublish and archive immediately remove member access; restore returns archived content to draft. Administrator edits use expected versions, no-op detection and transactionally durable property-free audit events.

## Progress and continuation

Progress is derived at read time as completed accessible resources divided by total accessible resources. The canonical `member_resource_state.completed_at` therefore counts everywhere a resource appears; saves do not count. No percentage or completed count is persisted. Show the derived measure only where it supports a practical decision. Any continuation link is optional, specific and does not lock or prescribe order; all items remain unlocked.

## Access, privacy and telemetry

Learning paths are available only behind the existing verified, entitled, onboarding-complete member gate. Forced RLS permits member reads only for published paths, administrator writes only through the administrator boundary, and owner-only access to following rows. Browser and identity-sync roles receive no direct grants. Member start/stop and administrator lifecycle audit metadata is `{}`. Analytics events are property-free: opened, started, stopped and completed. After a successful canonical resource-completion transaction, one completion event is emitted per published path that genuinely changes from incomplete to complete. Refreshes, repeated completion, unrelated completion and failed mutations emit none. If an editorial addition later makes a path incomplete, completing the new requirement may create another genuine transition. Derived reads are not audited.

## CMS and accessibility

The existing content CMS manages path metadata, sections and canonical resource references with labelled move-up/down controls, lifecycle buttons, validation feedback and generic conflict reload. Member pages use semantic headings, labelled progress, text equivalents, keyboard links, visible focus styles, touch-sized controls and responsive grids. Future quizzes, prerequisites, certificates, cohorts and standalone tasks require separate approved increments.
