import { SiteHeader } from "../../components/site-header";
import { PageHeader } from "../../components/page-header";

export default function JobsLoading() {
  return (
    <main className="catalogue-page">
      <SiteHeader />
      <div className="catalogue-shell">
        <PageHeader eyebrow="Roles from official employer sites" title="Find your next opportunity" />
        <div className="catalogue-layout">
          <div className="catalogue-sidebar-column">
            <div className="catalogue-sidebar-skeleton job-card-skeleton" aria-hidden="true" />
          </div>
          <div className="catalogue-results-column">
            <div className="catalogue-search job-card-skeleton" aria-hidden="true" />
            <div className="job-catalog-loading" aria-busy="true" aria-label="Loading jobs">
              {Array.from({ length: 5 }, (_, index) => (
                <div className="job-card job-card-skeleton" key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
