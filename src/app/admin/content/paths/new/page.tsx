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
    <main>
      <p className="eyebrow">Administrator CMS</p>
      <h1>Create learning path</h1>
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
