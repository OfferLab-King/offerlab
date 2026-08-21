import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "./components/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Turn real experience into stronger applications, truthful documents and interview answers in one private workspace for UK graduate recruitment.",
  openGraph: {
    description:
      "Turn real experience into stronger applications, truthful documents and interview answers in one private workspace for UK graduate recruitment.",
    title: "OfferLab — Build the proof behind every application",
    type: "website",
  },
  title: "OfferLab — Build the proof behind every application",
};

const workflow = [
  {
    number: "01",
    title: "Find the right opportunity",
    description:
      "Search current roles from official employer career sources and save the ones worth your time.",
  },
  {
    number: "02",
    title: "Build from real evidence",
    description:
      "Turn projects, work, volunteering and university experience into stories you can reuse.",
  },
  {
    number: "03",
    title: "Tailor without inventing",
    description:
      "Create role-specific CV and cover-letter versions while keeping every claim grounded in your work.",
  },
  {
    number: "04",
    title: "Practise the hard parts",
    description:
      "Prepare answers, study current intelligence and rehearse the moments that matter before selection day.",
  },
] as const;

const productAreas = [
  {
    className: "home-bento-card home-bento-card--wide home-bento-card--ink",
    eyebrow: "Answer Bank",
    title: "Fourteen questions. Your strongest evidence. Ready when the interview arrives.",
    description:
      "Prepare introductions, motivation and competency answers in one focused workspace. Save drafts, link evidence and keep your own voice.",
    href: "/register",
    linkLabel: "Start your Answer Bank",
  },
  {
    className: "home-bento-card home-bento-card--tall home-bento-card--sage",
    eyebrow: "Document review",
    title: "See the evidence your CV proves—and the gaps it does not.",
    description:
      "Requirement-by-requirement feedback shows what is represented, what is missing and what truthful evidence would strengthen the document.",
    href: "/plans",
    linkLabel: "Explore document feedback",
  },
  {
    className: "home-bento-card home-bento-card--paper",
    eyebrow: "Recruitment Intelligence",
    title: "Current context, without leaked questions.",
    description: "Search moderated, cycle-dated reports about formats, themes and assessed skills.",
    href: "/intelligence",
    linkLabel: "Browse intelligence",
  },
  {
    className: "home-bento-card home-bento-card--paper",
    eyebrow: "Official opportunities",
    title: "Start from a role that is actually open.",
    description:
      "Browse roles collected from official employer career pages and apply at the source.",
    href: "/jobs",
    linkLabel: "Search live roles",
  },
] as const;

export default function FoundationPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-main home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow home-kicker">The evidence-led graduate career workspace</p>
            <h1>
              Build the proof behind <span>every application.</span>
            </h1>
            <p className="home-hero-lead">
              Find real opportunities, turn your experience into compelling evidence and prepare
              every answer and document in one private workspace built for UK graduate recruitment.
            </p>
            <div className="marketing-actions home-hero-actions">
              <Link className="button-link home-primary-action" href="/register">
                Build your free workspace
              </Link>
              <Link className="home-text-action" href="/jobs">
                Browse current roles <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <ul aria-label="OfferLab product assurances" className="home-trust-list">
              <li>Free to start</li>
              <li>Private by design</li>
              <li>Your evidence stays yours</li>
            </ul>
          </div>

          <aside aria-label="OfferLab workspace example" className="home-workspace-preview">
            <div className="home-preview-topbar">
              <div>
                <span className="home-preview-dot" />
                <strong>Application workspace</strong>
              </div>
              <span className="home-preview-status">Interview</span>
            </div>
            <div className="home-preview-role">
              <span>Consumer strategy graduate</span>
              <strong>Northstar Foods</strong>
              <small>Final interview · 24 September</small>
            </div>
            <div className="home-preview-grid">
              <div className="home-preview-panel">
                <span className="home-preview-label">Evidence selected</span>
                <strong>Society event turnaround</strong>
                <p>Influencing · Judgement · Ownership</p>
              </div>
              <div className="home-preview-panel home-preview-panel--accent">
                <span className="home-preview-label">Answer status</span>
                <strong>Draft saved</strong>
                <p>Why this organisation?</p>
              </div>
            </div>
            <blockquote className="home-coach-note">
              <span>Coach note</span>
              <strong>Make your judgement visible.</strong>
              <p>
                What risk were you trying to remove when you spoke to the venue first? That decision
                is the strongest part of your example.
              </p>
            </blockquote>
            <div className="home-preview-footer">
              <span>Grounded in your evidence</span>
              <span>You remain the editor</span>
            </div>
          </aside>
        </section>

        <section aria-label="OfferLab workflow" className="home-workflow">
          <div className="home-section-heading home-section-heading--split">
            <div>
              <p className="eyebrow">One connected workflow</p>
              <h2>From finding the role to walking into the room.</h2>
            </div>
            <p>
              No generic course. No forced journey. Just the right structure around the application
              you are working on now.
            </p>
          </div>
          <ol className="home-workflow-grid">
            {workflow.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-proof-section">
          <div className="home-section-heading">
            <p className="eyebrow">Built for the work between applications</p>
            <h2>A serious workspace for becoming a stronger candidate.</h2>
            <p>
              OfferLab connects opportunity discovery, truthful evidence, preparation and current
              recruitment context—so every application makes the next one easier.
            </p>
          </div>
          <div className="home-bento-grid">
            {productAreas.map((area) => (
              <article className={area.className} key={area.title}>
                <p className="eyebrow">{area.eyebrow}</p>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
                <Link href={area.href}>{area.linkLabel} →</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-coaching-section">
          <div className="home-coaching-copy">
            <p className="eyebrow">OfferLab coaching method</p>
            <h2>Feedback that strengthens your thinking—not just your phrasing.</h2>
            <p>
              Generic tools polish sentences. OfferLab helps you expose the decision, evidence and
              reasoning that make an answer credible, while every edit remains yours to accept.
            </p>
            <Link className="home-text-action" href="/register">
              Prepare your first answer <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-coaching-comparison">
            <div>
              <span className="home-preview-label">Before</span>
              <p>
                “I worked with the team to solve the problem and make sure the event went ahead.”
              </p>
            </div>
            <div className="home-coaching-annotation">
              <span>01</span>
              <p>Name the decision only you made.</p>
            </div>
            <div className="home-coaching-annotation">
              <span>02</span>
              <p>Show the risk you saw and why your action came first.</p>
            </div>
            <div className="home-coaching-after">
              <span className="home-preview-label">What the stronger answer reveals</span>
              <p>Judgement, personal ownership and reasoning—not inflated language.</p>
            </div>
          </div>
        </section>

        <section className="home-membership-section">
          <div>
            <p className="eyebrow">OfferLab Membership</p>
            <h2>Start free. Add capacity when applications get serious.</h2>
            <p>
              Every core preparation capability remains available for free. Membership doubles your
              document-review capacity and includes selected new capabilities as they become
              available.
            </p>
          </div>
          <div className="home-membership-action">
            <span>From £9 / month</span>
            <Link className="button-link home-light-action" href="/plans">
              Compare membership options
            </Link>
          </div>
        </section>

        <section className="home-final-cta">
          <p className="eyebrow">Your experience is already there</p>
          <h2>Make it easier to find, explain and use.</h2>
          <p>
            Build your first evidence story and turn it into an answer you can say with confidence.
          </p>
          <div className="marketing-actions">
            <Link className="button-link home-primary-action" href="/register">
              Create your free account
            </Link>
            <Link className="home-text-action" href="/employers">
              Explore employers
            </Link>
          </div>
        </section>

        <footer className="home-footer">
          <div>
            <Link className="brand" href="/">
              <span aria-hidden="true" className="brand__mark" />
              <span className="brand__word">OfferLab</span>
            </Link>
            <p>Evidence-led preparation for UK graduate recruitment.</p>
          </div>
          <nav aria-label="Explore OfferLab">
            <Link href="/jobs">Jobs</Link>
            <Link href="/employers">Employers</Link>
            <Link href="/intelligence">Intelligence</Link>
            <Link href="/plans">Plans</Link>
          </nav>
          <nav aria-label="Your OfferLab account">
            <Link href="/register">Create account</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/member">Workspace</Link>
          </nav>
          <p className="home-footer-note">
            Official sources. Honest provenance. Private member work.
          </p>
        </footer>
      </main>
    </>
  );
}
