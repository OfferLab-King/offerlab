import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { readAllMembershipsForAdmin } from "../../../modules/membership/application/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminMembershipPage() {
  const administrator = await requireAdministrator();
  const memberships = await readAllMembershipsForAdmin(administrator.userId);

  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Memberships</h1>
          <p>
            Paid membership entitlements. Grants and cancellations are performed with the membership
            CLI (migration role); this screen is a read-only operational view.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="membership-list-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="membership-list-heading">
              Active and historical memberships ({memberships.length})
            </h2>
          </div>
        </div>
        {memberships.length === 0 ? (
          <p className="hint">No memberships have been granted yet.</p>
        ) : (
          <div className="cms-table-scroll">
            <table className="cms-data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Period start</th>
                  <th>Period end</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.userId}>
                    <td>
                      <strong>{membership.email}</strong>
                    </td>
                    <td>{membership.plan}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          membership.status === "active"
                            ? "status-badge--positive"
                            : "status-badge--warn"
                        }`}
                      >
                        {membership.status}
                      </span>
                    </td>
                    <td>{formatDate(membership.periodStart)}</td>
                    <td>{membership.periodEnd ? formatDate(membership.periodEnd) : "—"}</td>
                    <td>{membership.source}</td>
                    <td>{formatDate(membership.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
