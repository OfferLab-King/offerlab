import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import {
  listAdminResources,
  listCategories,
  listTags,
} from "../../../../modules/preparation-resources/application/admin-content";
import { runCreateResourceAction } from "../action-boundary";
import { ContentFields } from "../content-fields";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const admin = await requireAdministrator();
  const [categories, tags, resources] = await Promise.all([
    listCategories(admin.userId),
    listTags(admin.userId, true),
    listAdminResources(admin.userId),
  ]);
  async function create(form: FormData) {
    "use server";
    const result = await runCreateResourceAction(form);
    if ("id" in result) redirect(`/admin/content/${result.id}`);
    redirect("/admin/content/new?error=validation");
  }
  return (
    <main>
      <p className="eyebrow">Administrator CMS</p>
      <h1>Create draft</h1>
      <form action={create} className="application-form">
        <ContentFields categories={categories} resources={resources} tags={tags} />
        <button type="submit">Save draft</button>
      </form>
    </main>
  );
}
