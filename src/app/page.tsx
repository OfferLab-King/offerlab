import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "./components/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Prepare with evidence for UK graduate recruitment. Build reusable answers and stories, tailor a truthful CV or cover letter, practise each stage and track applications in one private workspace.",
  openGraph: {
    description:
      "Prepare with evidence for UK graduate recruitment. Build reusable answers and stories, tailor a truthful CV or cover letter, practise each stage and track applications in one private workspace.",
    title: "OfferLab — Prepare with evidence. Practise with purpose.",
    type: "website",
  },
  title: "OfferLab — Prepare with evidence. Practise with purpose.",
};

const availableTools = [
  {
    eyebrow: "Build",
    title: "Your Answer & Story Bank",
    description:
      "Turn university, work, volunteering and project experience into evidence you can reuse across interview questions.",
  },
  {
    eyebrow: "Prepare",
    title: "Core interview questions",
    description:
      "Focus on a curated question set by family and recruitment stage, then draft directly from your real examples.",
  },
  {
    eyebrow: "Learn",
    title: "Stage-specific preparation",
    description:
      "Use concise plans and resources for video interviews, online tests, assessment centres and final interviews.",
  },
] as const;

const distinctiveExperiences = [
  {
    availability: "In development",
    title: "Evidence-grounded AI Answer Coach",
    description:
      "Feedback based on your question, your linked stories and OfferLab's coaching rubric—not a generic answer written from nothing.",
  },
  {
    availability: "Collection in development",
    title: "Annotated coaching cases",
    description:
      "See the original answer, precise coach comments, the revision and why the stronger version works.",
  },
  {
    availability: "Pilot planned",
    title: "Group Mock",
    description:
      "Practise the group exercises you cannot rehearse alone, with a clear format and structured feedback.",
  },
  {
    availability: "Available",
    href: "/intelligence",
    title: "Current recruitment intelligence",
    description:
      "Search moderated, cycle-dated candidate reports by stage, format and assessed skill without sharing restricted questions.",
  },
] as const;

export default function FoundationPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="eyebrow">Graduate recruitment, made practicable</p>
            <h1>Prepare with evidence. Practise with purpose.</h1>
            <p className="marketing-lead">
              OfferLab helps you turn your real experience into stronger answers, prepare for each
              recruitment stage and access the practice and feedback that generic advice cannot give
              you.
            </p>
            <div className="marketing-actions">
              <Link className="button-link marketing-primary-action" href="/register">
                Start building your evidence
              </Link>
              <a href="#how-it-helps">See how OfferLab helps</a>
            </div>
            <p className="marketing-note">
              Free account · No invitation required ·{" "}
              <Link href="/plans">Membership available</Link>
            </p>
          </div>

          <aside aria-label="Example OfferLab coaching" className="coaching-preview">
            <div className="preview-toolbar">
              <span className="preview-label">Answer Coach preview</span>
              <span className="status-badge">In development</span>
            </div>
            <p className="preview-question">Tell me about a time you influenced a team.</p>
            <div className="preview-evidence">
              <span>Linked evidence</span>
              <strong>Student society event turnaround</strong>
            </div>
            <blockquote>
              <strong>Make your judgement visible.</strong>
              <span>
                You explain what the team did, but not why you chose to speak to the venue first.
                What risk were you trying to remove?
              </span>
            </blockquote>
            <p className="preview-footnote">Grounded in your story. You remain the editor.</p>
          </aside>
        </section>

        <section className="marketing-section homepage-jobs" aria-labelledby="homepage-jobs">
          <div className="section-introduction">
            <p className="eyebrow">Start from a real role</p>
            <h2 id="homepage-jobs">Discover a real role, then prepare for it properly</h2>
            <p>
              Jobs and Employers are built from employers&apos; official public career sources. Find
              a current role, understand what it asks for and apply on the employer&apos;s official
              website.
            </p>
          </div>
          <form action="/jobs" className="homepage-jobs-search" method="get">
            <label htmlFor="homepage-jobs-query">Search current roles</label>
            <div className="homepage-jobs-search-row">
              <input
                id="homepage-jobs-query"
                name="q"
                placeholder="Role, skill or keyword"
                type="search"
              />
              <button className="button-link" type="submit">
                Search jobs
              </button>
            </div>
          </form>
          <p className="homepage-jobs-link">
            <Link href="/employers">Explore employers by sector →</Link>
          </p>
          <p className="homepage-jobs-value">
            Save the role, tailor a truthful CV or cover letter, prepare your answers and track the
            application from one private workspace.
          </p>
        </section>

        <section className="marketing-section" id="how-it-helps">
          <div className="section-introduction">
            <p className="eyebrow">Useful from your first application</p>
            <h2>Build preparation you can reuse</h2>
            <p>
              Stop starting from a blank document for every application. Keep your evidence,
              questions and preparation together, then choose exactly what helps today.
            </p>
          </div>
          <div className="marketing-card-grid">
            {availableTools.map((tool) => (
              <article className="marketing-feature-card" key={tool.title}>
                <p className="eyebrow">{tool.eyebrow}</p>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section distinctive-section">
          <div className="section-introduction">
            <p className="eyebrow">More than another content library</p>
            <h2>Practice, judgement and current intelligence</h2>
            <p>
              These are the experiences OfferLab is developing and validating. Availability is
              labelled plainly so you always know what you can use now and what is being piloted.
            </p>
          </div>
          <div className="distinctive-grid">
            {distinctiveExperiences.map((experience) => (
              <article className="distinctive-card" key={experience.title}>
                <span className="availability-label">{experience.availability}</span>
                <h3>{experience.title}</h3>
                <p>{experience.description}</p>
                {"href" in experience && experience.href && (
                  <Link href={experience.href as never}>Browse current reports →</Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section membership-preview-section">
          <div className="section-introduction">
            <p className="eyebrow">OfferLab Membership</p>
            <h2>Stay free, upgrade when capacity matters</h2>
            <p>
              Every preparation capability stays free. Membership doubles your review capacity and
              gives you early access to new capabilities — clearly labelled, never hiding what was
              already free.
            </p>
          </div>
          <Link className="button-link marketing-primary-action" href="/plans">
            Compare plans
          </Link>
        </section>

        <section className="marketing-cta">
          <div>
            <p className="eyebrow">Start with what you already have</p>
            <h2>Your experience is more useful when you can find and explain it.</h2>
            <p>Create your first evidence story and use it to build a stronger interview answer.</p>
          </div>
          <Link className="button-link marketing-primary-action" href="/register">
            Create your free account
          </Link>
        </section>

        <footer className="marketing-footer">
          <Link className="brand" href="/">
            OfferLab
          </Link>
          <p>Practical preparation for UK graduate recruitment.</p>
          <Link href="/intelligence">Recruitment Intelligence</Link>
          <Link href="/plans">Plans</Link>
          <Link href="/member">Open workspace</Link>
        </footer>
      </main>
    </>
  );
}
