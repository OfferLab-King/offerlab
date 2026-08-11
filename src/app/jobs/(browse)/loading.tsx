import { SiteHeader } from "../../components/site-header";

export default function JobsLoading() {
  return (
    <main className="catalogue-page">
      <SiteHeader />
      <div className="catalogue-shell">
        <header className="catalogue-header">
          <h1>Find your next opportunity</h1>
        </header>
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
