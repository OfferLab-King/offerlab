import Link from "next/link";
import { notFound } from "next/navigation";
import { IntelligenceReportDetail } from "../../../../components/intelligence-report";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readIntelligenceReport } from "../../../../../modules/recruitment-intelligence/application/reports";
import { MemberApplicationsHeader } from "../../../applications/member-applications-header";
import { LearnNavigation } from "../../learn-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberIntelligenceReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await requireMember();
  const report = await readIntelligenceReport(userId, (await params).slug);
  if (!report || report.moderationState !== "published") notFound();
  return (
    <main className="applications-shell intelligence-report-page">
      <MemberApplicationsHeader />
      <LearnNavigation active="intelligence" />
      <div className="intelligence-back-link">
        <Link href="/member/learn/intelligence">← All intelligence reports</Link>
      </div>
      <IntelligenceReportDetail report={report} />
    </main>
  );
}
