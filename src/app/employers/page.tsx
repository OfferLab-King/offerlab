import type { Metadata } from "next";

import {
  readEmployerDirectory,
  readSectorJobCounts,
} from "../../modules/job-catalog/application/catalog";
import { SiteHeader } from "../components/site-header";
import { EmployerDirectoryView } from "./employer-directory-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/employers" },
  description:
    "Explore leading employers by sector, with live counts of current roles sourced from official career sites.",
  title: "Explore Employers | OfferLab",
};

export default async function EmployersDirectoryPage() {
  const [rows, sectorCounts] = await Promise.all([readEmployerDirectory(), readSectorJobCounts()]);
  const employerCount = new Set(rows.map((row) => row.company_slug)).size;
  const hiringCount = new Set(
    rows.filter((row) => row.active_count > 0).map((row) => row.company_slug),
  ).size;
  return (
    <main className="employers-page">
      <SiteHeader />
      <div className="employer-directory">
        <header className="employer-directory-hero">
          <div>
            <p className="catalogue-eyebrow">Employer and industry directory</p>
            <h1>Explore employers by sector</h1>
            <p className="catalogue-subtitle">
              Browse priority UK employers by industry, then open their current roles or official
              careers pages. Employers without an open role remain visible for research.
            </p>
          </div>
          <p className="employer-directory-summary">
            <strong>{employerCount}</strong> employers · {hiringCount} hiring now
          </p>
        </header>
        <EmployerDirectoryView rows={rows} sectorCounts={sectorCounts} />
      </div>
    </main>
  );
}
