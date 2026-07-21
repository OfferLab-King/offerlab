import { notFound } from "next/navigation";
import { ResourceContent } from "../../components/resource-content";
import { readPublicResource } from "../../../modules/preparation-resources/application/resources";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const r = await readPublicResource((await params).slug);
  if (!r) notFound();
  return (
    <main className="public-resource">
      <ResourceContent resource={r} />
    </main>
  );
}
