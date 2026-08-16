import type { Metadata } from "next";
import Link from "next/link";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { readAuditEventsForAdmin } from "../../../../modules/audit/application/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Audit trail | OfferLab admin",
};

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(value);
}

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const administrator = await requireAdministrator();
  const raw = await searchParams;
  const action = typeof raw.action === "string" ? raw.action : undefined;
  const entityType = typeof raw.entityType === "string" ? raw.entityType : undefined;
  const page = typeof raw.page === "string" ? Number(raw.page) : 1;
  const { events, hasNextPage } = await readAuditEventsForAdmin(administrator.userId, {
    action,
    entityType,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  });
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const query = new URLSearchParams();
  if (action) query.set("action", action);
  if (entityType) query.set("entityType", entityType);

  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Audit trail</h1>
          <p>
            Append-only, allow-listed administrative events. No member notes, answers or personal
            data are stored here.
          </p>
        </div>
        <Link className="button-secondary button-link" href="/admin/operations">
          Back to operations
        </Link>
      </header>
      <form className="cms-audit-filters" method="get">
        <label>
          Action contains
          <input defaultValue={action ?? ""} name="action" placeholder="e.g. content.published" />
        </label>
        <label>
          Entity type contains
          <input defaultValue={entityType ?? ""} name="entityType" placeholder="e.g. preparation_resource" />
        </label>
        <button type="submit">Filter</button>
      </form>
      {events.length === 0 ? (
        <section className="card empty-state">
          <h2>No matching audit events</h2>
          <p>Try a different filter or clear the fields to see the full trail.</p>
          <Link href="/admin/operations/audit">Clear filters</Link>
        </section>
      ) : (
        <>
          <ul className="cms-audit-list">
            {events.map((event) => (
              <li className="cms-operation-card cms-audit-row" key={event.id}>
                <span className="cms-meta-badge">{event.action}</span>
                <code>{event.entityType}</code>
                {event.entityId && <code title={event.entityId}>{event.entityId.slice(0, 8)}…</code>}
                <span>{formatTimestamp(event.createdAt)}</span>
                <span className="cms-meta-badge">actor {event.actorUserId.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
          <nav aria-label="Audit pages" className="pagination">
            {currentPage > 1 ? (
              <Link href={`/admin/operations/audit?${query.toString()}&page=${currentPage - 1}`}>
                Previous
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span aria-current="page">Page {currentPage}</span>
            {hasNextPage ? (
              <Link href={`/admin/operations/audit?${query.toString()}&page=${currentPage + 1}`}>
                Next
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        </>
      )}
    </main>
  );
}