"use server";
import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import {
  createPathDraft,
  updatePath,
} from "../../../../modules/learning-paths/application/admin-learning-paths";
export async function createPathAction(form: FormData) {
  const admin = await requireAdministrator();
  const result = await createPathDraft(admin.userId, form);
  if (result.ok) redirect(`/admin/content/paths/${result.id}?status=created`);
  redirect(
    `/admin/content/paths/new?error=${encodeURIComponent(
      "error" in result && result.error ? result.error : "validation",
    )}`,
  );
}
export async function updatePathAction(pathId: string, form: FormData) {
  const admin = await requireAdministrator();
  const result = await updatePath(
    admin.userId,
    pathId,
    Number(form.get("expectedVersion")),
    form,
    String(form.get("intent") ?? "save"),
  );
  if (!result.ok)
    redirect(
      `/admin/content/paths/${pathId}?error=${encodeURIComponent(
        "conflict" in result && result.conflict
          ? "conflict"
          : "error" in result && result.error
            ? result.error
            : "validation",
      )}`,
    );
  redirect(`/admin/content/paths/${pathId}?status=${result.outcome}`);
}
