"use client";

import Link from "next/link";

export default function JobsError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  void error;
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="OfferLab home">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__word">OfferLab</span>
          </Link>
        </div>
      </header>
      <main className="public-jobs-page">
        <section className="job-catalog-error" role="alert">
          <h1>The job catalogue could not be loaded</h1>
          <p>Something went wrong while looking up the latest roles. Try again in a moment.</p>
          <button className="button-link" onClick={reset} type="button">
            Try again
          </button>
        </section>
      </main>
    </>
  );
}
