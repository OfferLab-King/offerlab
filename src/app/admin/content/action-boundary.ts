import "server-only";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  createDraft,
  createTaxonomy,
  updateResource,
  updateTaxonomy,
} from "../../../modules/preparation-resources/application/admin-content";

type Actor = Readonly<{ userId: string }>;
type ActionResult =
  | Readonly<{ ok: true; outcome?: "changed" | "unchanged" }>
  | Readonly<{ conflict?: boolean; error?: string; ok: false }>;

export type CmsActionOutcome = Readonly<{
  errorMessage?: string;
  outcome: "changed" | "conflict" | "created" | "unchanged" | "validation";
}>;

function safeOutcome(result: ActionResult): CmsActionOutcome {
  if (result.ok) return { outcome: result.outcome ?? "created" };
  return result.conflict
    ? { outcome: "conflict" }
    : { errorMessage: result.error ?? "validation", outcome: "validation" };
}

type ResourceActionDependencies = Readonly<{
  authorize: () => Promise<Actor>;
  mutate: typeof updateResource;
}>;

const resourceDependencies: ResourceActionDependencies = {
  authorize: requireAdministrator,
  mutate: updateResource,
};

export async function runResourceMutationAction(
  resourceId: string,
  form: FormData,
  dependencies: ResourceActionDependencies = resourceDependencies,
): Promise<CmsActionOutcome> {
  const actor = await dependencies.authorize();
  const expectedVersion = Number(form.get("expectedVersion"));
  const intent = String(form.get("intent") ?? "save");
  return safeOutcome(
    await dependencies.mutate(actor.userId, resourceId, expectedVersion, form, intent),
  );
}

type CreateResourceActionDependencies = Readonly<{
  authorize: () => Promise<Actor>;
  mutate: typeof createDraft;
}>;

const createResourceDependencies: CreateResourceActionDependencies = {
  authorize: requireAdministrator,
  mutate: createDraft,
};

export async function runCreateResourceAction(
  form: FormData,
  dependencies: CreateResourceActionDependencies = createResourceDependencies,
) {
  const actor = await dependencies.authorize();
  const result = await dependencies.mutate(actor.userId, form);
  return result.ok
    ? ({ id: result.id, outcome: "created" } as const)
    : ("error" in result && result.error
        ? ({ errorMessage: result.error, outcome: "validation" } as const)
        : ({ outcome: "validation" } as const));
}

type CreateTaxonomyActionDependencies = Readonly<{
  authorize: () => Promise<Actor>;
  mutate: typeof createTaxonomy;
}>;

const createTaxonomyDependencies: CreateTaxonomyActionDependencies = {
  authorize: requireAdministrator,
  mutate: createTaxonomy,
};

export async function runCreateTaxonomyAction(
  kind: "category" | "tag",
  form: FormData,
  dependencies: CreateTaxonomyActionDependencies = createTaxonomyDependencies,
): Promise<CmsActionOutcome> {
  const actor = await dependencies.authorize();
  const result = await dependencies.mutate(actor.userId, kind, {
    description: kind === "category" ? String(form.get("description") ?? "") || null : undefined,
    name: String(form.get("name") ?? ""),
    slug: String(form.get("slug") ?? ""),
  });
  return safeOutcome(result);
}

type UpdateTaxonomyActionDependencies = Readonly<{
  authorize: () => Promise<Actor>;
  mutate: typeof updateTaxonomy;
}>;

const updateTaxonomyDependencies: UpdateTaxonomyActionDependencies = {
  authorize: requireAdministrator,
  mutate: updateTaxonomy,
};

export async function runUpdateTaxonomyAction(
  kind: "category" | "tag",
  form: FormData,
  dependencies: UpdateTaxonomyActionDependencies = updateTaxonomyDependencies,
): Promise<CmsActionOutcome> {
  const actor = await dependencies.authorize();
  const result = await dependencies.mutate(
    actor.userId,
    kind,
    String(form.get("id") ?? ""),
    Number(form.get("version")),
    {
      description: kind === "category" ? String(form.get("description") ?? "") || null : undefined,
      name: String(form.get("name") ?? ""),
    },
    String(form.get("intent") ?? "save") as "archive" | "restore" | "save",
  );
  return safeOutcome(result);
}
