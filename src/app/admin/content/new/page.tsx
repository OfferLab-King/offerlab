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
    <main className="cms-page cms-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">New content</p>
          <h1>Create content</h1>
          <p>Start as a private draft. Nothing becomes visible until you publish it.</p>
        </div>
      </header>
      <form action={create} className="application-form cms-resource-form">
        <ContentFields categories={categories} resources={resources} tags={tags} />
        <div className="cms-sticky-actions">
          <span>New private draft</span>
          <button type="submit">Save draft</button>
        </div>
      </form>
    </main>
  );
}
