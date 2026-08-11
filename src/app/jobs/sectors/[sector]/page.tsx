import { permanentRedirect } from "next/navigation";
import { parseJobSectorKey } from "../../../../modules/job-catalog/domain/taxonomy";
import { slugToKey } from "../../../../modules/job-catalog/domain/catalog";

type SectorParams = Promise<{ sector: string }>;

export default async function RetiredSectorPage({ params }: { params: SectorParams }) {
  const { sector } = await params;
  const sectorKey = parseJobSectorKey(slugToKey(sector));
  permanentRedirect(
    sectorKey ? `/employers?sector=${sectorKey}#sector-${sectorKey}` : "/employers",
  );
}
