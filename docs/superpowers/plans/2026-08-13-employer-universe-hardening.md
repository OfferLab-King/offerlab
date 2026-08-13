# Employer Universe Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed post-PR #27 employer-linkage, identity-matching, and analytics defects with minimum new coverage and no feature expansion.

**Architecture:** Preserve the existing modular-monolith boundaries. The client sends canonical selection state, the applications repository resolves it against the public employer contract in the same transaction, identity matching refuses non-unique evidence, and analytics selects one current snapshot per company before aggregation.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, PostgreSQL/Supabase, postgres.js, Vitest, Playwright.

## Global Constraints

- Use Node.js 24.x and pnpm 11.9.0.
- Work only in `/Users/teaching/Desktop/offerlab-worktrees/employer-universe-hardening` on `codex/employer-universe-hardening`.
- Never reset or stop the persistent `offerlab` Supabase project; use the existing disposable `offerlab_hardening_baseline` setup on ports 56320–56329.
- Extend existing tests before creating test files; do not duplicate equivalent assertions.
- Run targeted tests during implementation and one full validation sequence at completion.
- Do not expand crawler, taxonomy, employer, admin, member, public, or SEO features.

---

### Task 1: Preserve and validate canonical employer selections

**Files:**

- Modify: `src/modules/applications/application/request.ts`
- Modify: `src/modules/applications/application/request.test.ts`
- Modify: `src/app/member/applications/application-form.tsx`
- Modify: `src/app/member/applications/employer-company-field.tsx`
- Modify: `src/modules/applications/infrastructure/application-repository.ts`
- Modify: `tests/integration/member-employer-integration.test.ts`

**Interfaces:**

- Produces: `applicationFormRequestBody(form: FormData, version?: number): Record<string, unknown>` including `companyId`.
- Produces: `EmployerCompanyField` prop `defaultCompanyId: string | null`.
- Repository invariant: a selected ID is retained only when it resolves through `app.employer_public_profile`; a valid selection stores the canonical name, while an unresolved ID falls back to unlinked free text.

- [ ] **Step 1: Extend the existing request-boundary test with the missing client payload invariant**

Add a `FormData` case to `request.test.ts`:

```ts
const form = new FormData();
form.set("company", "Displayed text");
form.set("companyId", "00000000-0000-4000-8000-000000000123");
form.set("role", "Graduate Analyst");
// set the remaining current form fields
expect(applicationFormRequestBody(form, 3)).toMatchObject({
  company: "Displayed text",
  companyId: "00000000-0000-4000-8000-000000000123",
  version: 3,
});
```

- [ ] **Step 2: Run the focused unit test and confirm it fails because the helper is absent**

Run: `pnpm test:unit -- src/modules/applications/application/request.test.ts`

Expected: FAIL because `applicationFormRequestBody` is not exported.

- [ ] **Step 3: Implement and use the shared request-body helper**

Move the existing `FormData` extraction from `ApplicationForm.body` into `applicationFormRequestBody`, include:

```ts
companyId: optional("companyId"),
```

Use the helper for POST and PUT payloads. Pass `initial.companyId` into `EmployerCompanyField`, initialise its hidden state from that prop, and continue clearing it only when the visible company text changes.

- [ ] **Step 4: Extend the existing member-employer integration test with canonicalisation and invalid-ID fallback**

In the existing application-linkage test:

```ts
expect(created.application).toMatchObject({ companyId, company: "Application Linked Co" });
```

Create with the same `companyId` but tampered display text and assert the stored name is canonical. Create with a non-existent UUID and assert the free-text name remains while `companyId` becomes `null`. Update the linked application with an unrelated field change and assert its ID remains linked.

- [ ] **Step 5: Implement transactional canonical resolution**

Before insert/update, resolve non-null `companyId` through `app.employer_public_profile` inside the existing `offerlab_app` transaction:

```ts
const selected = await database<{ id: string; name: string }[]>`
  select id, name from app.employer_public_profile
  where id = ${values.companyId}::uuid
  limit 1
`;
```

Use the selected canonical name and ID when found; otherwise use `{ ...values, companyId: null }`. Apply this once through a private repository helper shared by create and update.

- [ ] **Step 6: Run only the affected tests**

Run:

```bash
pnpm test:unit -- src/modules/applications/application/request.test.ts
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres pnpm test:integration -- tests/integration/member-employer-integration.test.ts
```

Expected: both focused files pass.

- [ ] **Step 7: Commit the linkage batch**

```bash
git add src/modules/applications/application/request.ts src/modules/applications/application/request.test.ts src/app/member/applications/application-form.tsx src/app/member/applications/employer-company-field.tsx src/modules/applications/infrastructure/application-repository.ts tests/integration/member-employer-integration.test.ts
git commit -m "fix: preserve canonical employer links"
```

### Task 2: Refuse ambiguous employer identity evidence

**Files:**

- Modify: `src/modules/employer-research/domain/identity-match.ts`
- Modify: `src/modules/employer-research/domain/identity-match.test.ts`

**Interfaces:**

- Preserves: `matchCanonicalEmployer(...): IdentityMatch`.
- Changes: every evidence stage returns a company only when exactly one distinct company matches; zero or multiple distinct matches continue to later evidence or finish as `ambiguous` without insertion-order selection.

- [ ] **Step 1: Parameterise the existing identity test with duplicate normalized, slug, alias, and website evidence**

For each evidence type, provide two companies or aliases resolving to different IDs and assert:

```ts
expect(match).toMatchObject({ grade: "ambiguous", companyId: null });
expect(match.reason).toContain("multiple");
```

- [ ] **Step 2: Run the focused unit test and confirm the duplicate cases fail**

Run: `pnpm test:unit -- src/modules/employer-research/domain/identity-match.test.ts`

Expected: FAIL because current `Map`/`find` logic picks one match.

- [ ] **Step 3: Implement unique-candidate matching once**

Add a private helper that deduplicates candidate company IDs and returns `none`, `unique`, or `ambiguous`. Use it in normalized-name, slug, alias, and website-host stages. Return an ambiguous result immediately when a stage has multiple distinct matches.

- [ ] **Step 4: Run the identity and import-plan tests**

Run:

```bash
pnpm test:unit -- src/modules/employer-research/domain/identity-match.test.ts src/modules/employer-research/application/import-plan.test.ts
```

Expected: both existing groups pass.

- [ ] **Step 5: Commit the identity batch**

```bash
git add src/modules/employer-research/domain/identity-match.ts src/modules/employer-research/domain/identity-match.test.ts
git commit -m "fix: reject ambiguous employer identity matches"
```

### Task 3: Count only current employer research snapshots

**Files:**

- Modify: `src/modules/employer-research/infrastructure/discovery-repository.ts`
- Modify: `tests/integration/employer-source-discovery.test.ts`

**Interfaces:**

- Preserves: `readPlatformCoverageData(database): Promise<PlatformCoverageSourceData>`.
- Changes: `snapshots` contains at most one row per non-null company ID, selected by `research_date desc, dataset_version desc`.

- [ ] **Step 1: Extend the existing platform-coverage integration test**

Insert an older snapshot for the same fixture company with a different tier/platform, call `readPlatformCoverageData`, and assert exactly one snapshot exists for that company and it contains the latest values.

- [ ] **Step 2: Run the focused integration test and confirm it fails with two snapshots**

Run:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres pnpm test:integration -- tests/integration/employer-source-discovery.test.ts
```

Expected: FAIL because the repository currently selects every historical snapshot.

- [ ] **Step 3: Select the latest snapshot per resolved company**

Replace the snapshot query with:

```sql
select distinct on (company_id)
  company_id as "companyId", priority_tier as tier, ats_platform as "atsPlatform"
from app.employer_research_snapshot
where company_id is not null
order by company_id, research_date desc, dataset_version desc
```

- [ ] **Step 4: Run the affected source-discovery unit and integration groups**

Run:

```bash
pnpm test:unit -- src/modules/employer-research/application/source-discovery.test.ts
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres pnpm test:integration -- tests/integration/employer-source-discovery.test.ts tests/integration/admin-employer-detail.test.ts
```

Expected: all affected groups pass.

- [ ] **Step 5: Commit the analytics batch**

```bash
git add src/modules/employer-research/infrastructure/discovery-repository.ts tests/integration/employer-source-discovery.test.ts
git commit -m "fix: deduplicate employer capability analytics"
```

### Task 4: Complete the evidence-based hardening review

**Files:**

- Create only if findings warrant it: `docs/reviews/2026-08-13-employer-universe-hardening.md`
- Modify only files required by additional confirmed defects.

- [ ] **Step 1: Inspect remaining high-risk paths without rebuilding prior review work**

Review source promotion/verification, outbound URL safety and robots handling, RLS/grants, public-profile data exposure/indexability, bounded directory/autocomplete queries, and admin detail actions. Record only reproducible defects, grouping shared root causes.

- [ ] **Step 2: For each additional confirmed defect, extend the nearest existing test first**

Run only that smallest test target, implement the root-cause fix, and rerun that target. Do not add a standalone review test suite or speculative benchmark.

- [ ] **Step 3: Write a concise review summary**

List fixed findings, affected files/tests, any unresolved risk with explicit uncertainty, and excluded non-defects. Do not repeat implementation details already visible in commits and tests.

### Task 5: Run final verification once

**Files:**

- No planned source changes.

- [ ] **Step 1: Start and replay the established disposable Supabase project**

Use the copied Supabase workdir under the Codex `work/` directory, verify project ID `offerlab_hardening_baseline` and DB port `56322`, then run one `supabase db reset --local` there.

- [ ] **Step 2: Run the complete final application validation under Node 24.18.0 / pnpm 11.9.0**

Run once:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres DATABASE_MIGRATION_URL=postgresql://postgres:postgres@127.0.0.1:56322/postgres pnpm test:integration
pnpm build
pnpm security:audit
```

- [ ] **Step 3: Run only relevant browser coverage against the disposable stack**

Invoke Playwright directly with disposable Supabase/API environment values and the existing application/employer specs; do not use `scripts/run-e2e.ts`, which hardcodes the persistent `offerlab` container name and database commands.

- [ ] **Step 4: Verify repository state and report evidence**

Confirm no dependency or lockfile drift, list commits and changed files, stop only the disposable Supabase project, and report exact pass/failure counts without claiming unrun checks.
