import { permanentRedirect } from "next/navigation";
import {
  parseJobSectorKey,
  parseJobSubsectorKey,
} from "../../../../../modules/job-catalog/domain/taxonomy";
import { slugToKey } from "../../../../../modules/job-catalog/domain/catalog";

type SubsectorParams = Promise<{ sector: string; subsector: string }>;

export default async function RetiredSubsectorPage({ params }: { params: SubsectorParams }) {
  const { sector, subsector } = await params;
  const sectorKey = parseJobSectorKey(slugToKey(sector));
  const subsectorKey = parseJobSubsectorKey(slugToKey(subsector));
  if (!sectorKey || !subsectorKey) permanentRedirect("/employers");
  permanentRedirect(`/employers?sector=${sectorKey}&subsector=${subsectorKey}#sector-${sectorKey}`);
}
