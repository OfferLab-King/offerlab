import { redirect } from "next/navigation";
import { readCareerDocuments } from "../../../modules/career-documents/application/career-documents";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { CareerDocumentList } from "../career-document-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CoverLettersPage() {
  const { userId } = await requireMember();
  if (!(await readOnboardingProfile(userId))?.completedAt) redirect("/member/onboarding");
  return (
    <CareerDocumentList
      documents={await readCareerDocuments(userId, "cover_letter")}
      kind="cover_letter"
    />
  );
}
