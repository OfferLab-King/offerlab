import { describe, expect, it } from "vitest";

import {
  assertCatalogueDeleteScope,
  buildCleanupPlan,
  catalogueDeleteOrder,
  isLoopbackDatabaseUrl,
  parseCleanupOptions,
} from "./synthetic-catalog-cleanup";

const target = (id: string, name: string, slug: string) => ({
  id,
  expectedName: name,
  expectedSlug: slug,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Facet Test Co",
  slug: "facet-test-co-msqd4tyv-vdesi7",
  careersUrl: "https://facet-c-msqd4tyv-wus8va.example.com",
  directoryVisible: false,
  sources: 0,
  jobs: 5,
  runs: 0,
  events: 0,
  savedJobs: 0,
  ...overrides,
});

describe("parseCleanupOptions", () => {
  it("defaults to dry-run without confirmation", () => {
    expect(parseCleanupOptions([])).toEqual({ apply: false, confirmed: false });
    expect(parseCleanupOptions(["--dry-run"])).toEqual({ apply: false, confirmed: false });
  });

  it("treats --confirm-local alone as a confirmed dry run", () => {
    expect(parseCleanupOptions(["--confirm-local"])).toEqual({ apply: false, confirmed: true });
  });

  it("requires both --confirm-local and --apply for write mode", () => {
    expect(parseCleanupOptions(["--confirm-local", "--apply"])).toEqual({
      apply: true,
      confirmed: true,
    });
    expect(() => parseCleanupOptions(["--apply"])).toThrow(/--confirm-local/);
  });
});

describe("isLoopbackDatabaseUrl", () => {
  it.each([
    ["postgresql://postgres:postgres@127.0.0.1:55322/postgres", true],
    ["postgresql://postgres:postgres@localhost:55322/postgres", true],
    ["postgresql://postgres:postgres@[::1]:55322/postgres", true],
    ["postgresql://postgres:postgres@db:55322/postgres", false],
    ["postgresql://postgres:postgres@supabase.example.com:55322/postgres", false],
    ["not a url", false],
    ["", false],
  ])("classifies %s as %s", (url, expected) => {
    expect(isLoopbackDatabaseUrl(url)).toBe(expected);
  });
});

describe("buildCleanupPlan", () => {
  const allowList = [
    target(
      "11111111-1111-4111-8111-111111111111",
      "Facet Test Co",
      "facet-test-co-msqd4tyv-vdesi7",
    ),
  ];
  const preserve = [
    { id: "22222222-2222-4222-8222-222222222222", reason: "jobs saved by a member" },
  ];

  it("matches exact allow-list identities", () => {
    const plan = buildCleanupPlan(allowList, preserve, [row()]);
    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0]!.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(plan.mismatched).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
    expect(plan.unexpected).toHaveLength(0);
  });

  it("flags an identity mismatch and never includes the row in matched", () => {
    const plan = buildCleanupPlan(allowList, preserve, [
      row({ name: "Facet Test Co", slug: "different-slug-abc" }),
    ]);
    expect(plan.matched).toHaveLength(0);
    expect(plan.mismatched).toHaveLength(1);
    expect(plan.mismatched[0]).toMatchObject({
      actualName: "Facet Test Co",
      actualSlug: "different-slug-abc",
    });
  });

  it("reports missing targets instead of failing (idempotent second run)", () => {
    const plan = buildCleanupPlan(allowList, preserve, []);
    expect(plan.matched).toHaveLength(0);
    expect(plan.missing).toHaveLength(1);
    expect(plan.missing[0]!.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("refuses deletion of targets whose jobs are saved by a member", () => {
    const plan = buildCleanupPlan(allowList, preserve, [row({ savedJobs: 1 })]);
    expect(plan.matched).toHaveLength(0);
    expect(plan.blockedBySavedJobs).toHaveLength(1);
    expect(plan.blockedBySavedJobs[0]!.savedJobs).toBe(1);
  });

  it("keeps preserved companies out of the deletion set", () => {
    const plan = buildCleanupPlan(allowList, preserve, [
      row(),
      row({
        id: "22222222-2222-4222-8222-222222222222",
        name: "RLS Test Co",
        slug: "rls-test-co-msqd4t3q-ne6e9g",
        savedJobs: 1,
      }),
    ]);
    expect(plan.preserved).toHaveLength(1);
    expect(plan.preserved[0]!.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(plan.matched).toHaveLength(1);
  });

  it("flags companies outside the allow and preserve lists as unexpected", () => {
    const plan = buildCleanupPlan(allowList, preserve, [
      row(),
      row({
        id: "33333333-3333-4333-8333-333333333333",
        name: "Monzo",
        slug: "monzo",
      }),
    ]);
    expect(plan.unexpected).toHaveLength(1);
    expect(plan.unexpected[0]!.name).toBe("Monzo");
  });
});

describe("assertCatalogueDeleteScope", () => {
  it("allows only the reviewed catalogue deletion order", () => {
    expect(catalogueDeleteOrder).toEqual([
      "app.job_ingestion_run",
      "app.job_source_event",
      "app.job",
      "app.job_source",
      "app.company",
    ]);
    expect(() => assertCatalogueDeleteScope(catalogueDeleteOrder)).not.toThrow();
  });

  it("refuses any forbidden or member-owned table", () => {
    for (const table of [
      "auth.users",
      "app.user",
      "app.user_saved_job",
      "app.member_answer",
      "app.application",
      "app.career_document",
      "app.audit_event",
    ]) {
      expect(() => assertCatalogueDeleteScope([table])).toThrow(/refus/i);
    }
  });
});
