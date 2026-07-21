import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  runCreateResourceAction,
  runCreateTaxonomyAction,
  runResourceMutationAction,
  runUpdateTaxonomyAction,
} from "../../src/app/admin/content/action-boundary";

const submittedSentinel = "UNAUTHORIZED_CMS_BODY_SENTINEL_8A41";

function extractionTrap() {
  let reads = 0;
  const form = new Proxy(new FormData(), {
    get() {
      reads += 1;
      throw new Error(submittedSentinel);
    },
  });
  return { form, reads: () => reads };
}

function denied(path: string) {
  return async () => {
    throw new Error(`NEXT_REDIRECT;${path}`);
  };
}

describe("Knowledge Library Server Action authorization boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [
      "resource creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateResourceAction(form, { authorize, mutate: mutate as never }),
    ],
    [
      "resource mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runResourceMutationAction("00000000-0000-4000-8000-000000000001", form, {
          authorize,
          mutate: mutate as never,
        }),
    ],
    [
      "category creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateTaxonomyAction("category", form, { authorize, mutate: mutate as never }),
    ],
    [
      "tag creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateTaxonomyAction("tag", form, { authorize, mutate: mutate as never }),
    ],
    [
      "category mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runUpdateTaxonomyAction("category", form, { authorize, mutate: mutate as never }),
    ],
    [
      "tag mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runUpdateTaxonomyAction("tag", form, { authorize, mutate: mutate as never }),
    ],
  ])(
    "rejects unauthenticated %s before field extraction or application access",
    async (_name, invoke) => {
      const { form, reads } = extractionTrap();
      const mutate = vi.fn();
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const result = invoke(form, denied("/sign-in?next=/member"), mutate);

      await expect(result).rejects.toThrow("NEXT_REDIRECT");
      expect(reads()).toBe(0);
      expect(mutate).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(await result.catch((error: unknown) => String(error))).not.toContain(
        submittedSentinel,
      );
    },
  );

  it.each([
    [
      "resource creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateResourceAction(form, { authorize, mutate: mutate as never }),
    ],
    [
      "resource mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runResourceMutationAction("00000000-0000-4000-8000-000000000001", form, {
          authorize,
          mutate: mutate as never,
        }),
    ],
    [
      "category creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateTaxonomyAction("category", form, { authorize, mutate: mutate as never }),
    ],
    [
      "tag creation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runCreateTaxonomyAction("tag", form, { authorize, mutate: mutate as never }),
    ],
    [
      "category mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runUpdateTaxonomyAction("category", form, { authorize, mutate: mutate as never }),
    ],
    [
      "tag mutation",
      (form: FormData, authorize: () => Promise<never>, mutate: ReturnType<typeof vi.fn>) =>
        runUpdateTaxonomyAction("tag", form, { authorize, mutate: mutate as never }),
    ],
  ])("rejects a verified non-administrator %s at the same boundary", async (_name, invoke) => {
    const { form, reads } = extractionTrap();
    const mutate = vi.fn();
    const result = invoke(form, denied("/access-denied"), mutate);

    await expect(result).rejects.toThrow("NEXT_REDIRECT");
    expect(reads()).toBe(0);
    expect(mutate).not.toHaveBeenCalled();
    expect(await result.catch((error: unknown) => String(error))).not.toContain(submittedSentinel);
  });

  it("allow-lists conflict outcomes at the action boundary", async () => {
    const form = new FormData();
    form.set("expectedVersion", "41");
    form.set("intent", "publish");
    form.set("title", "PRIVATE_TITLE_SENTINEL");
    const result = await runResourceMutationAction("00000000-0000-4000-8000-000000000001", form, {
      authorize: async () => ({ userId: "00000000-0000-4000-8000-000000000002" }),
      mutate: vi.fn().mockResolvedValue({
        conflict: true,
        currentVersion: 42,
        error: "PRIVATE_INFRASTRUCTURE_SENTINEL",
        ok: false,
      }) as never,
    });

    expect(result).toEqual({ outcome: "conflict" });
    expect(Object.keys(result)).toEqual(["outcome"]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|version|uuid|error/iu);
  });
});
