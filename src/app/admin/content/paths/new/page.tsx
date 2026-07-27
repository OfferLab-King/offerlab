import { requireAdministrator } from "../../../../../modules/identity-access/application/authorization";
import { readPathEditorOptions } from "../../../../../modules/learning-paths/application/admin-learning-paths";
import { createPathAction } from "../actions";
import { PathEditor } from "../path-editor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const admin = await requireAdministrator();
  const options = await readPathEditorOptions(admin.userId);
  return (
    <main className="cms-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Preparation paths</p>
          <h1>Create learning path</h1>
          <p>Start with the path details, then add sections and order their resources.</p>
        </div>
      </header>
      <PathEditor
        action={createPathAction}
        categories={options.categories}
        initial={{
          introduction: "",
          primaryCategoryId: null,
          sections: [],
          shortDescription: "",
          slug: "new-learning-path",
          title: "",
        }}
        resources={options.resources}
      />
    </main>
  );
}
