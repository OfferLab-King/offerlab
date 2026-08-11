"use client";

export default function JobsError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  void error;
  return (
    <main className="public-jobs-page">
      <nav aria-label="Public" className="public-jobs-nav">
        <span className="brand">OfferLab</span>
      </nav>
      <section className="job-catalog-error" role="alert">
        <h1>The job catalogue could not be loaded</h1>
        <p>Something went wrong while looking up the latest roles. Try again in a moment.</p>
        <button className="button-link" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
