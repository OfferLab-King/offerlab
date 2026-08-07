import Link from "next/link";

import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readGroupMockCaseLibrary } from "../../../../../modules/practice-services/application/group-mock";
import {
  groupMockDifficulties,
  groupMockExerciseTypes,
  groupMockProblemTypes,
  groupMockSectors,
} from "../../../../../modules/practice-services/domain/group-mock";
import { MemberApplicationsHeader } from "../../../applications/member-applications-header";
import { LearnNavigation } from "../../learn-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GroupMockCaseLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    difficulty?: string;
    problem?: string;
    q?: string;
    sector?: string;
    type?: string;
  }>;
}) {
  const { userId } = await requireMember();
  const [cases, query] = await Promise.all([readGroupMockCaseLibrary(userId), searchParams]);
  const search = query.q?.trim().toLowerCase() ?? "";
  const visible = cases.filter(
    (item) =>
      (!search ||
        `${item.title} ${item.summary} ${item.skills.join(" ")}`.toLowerCase().includes(search)) &&
      (!query.sector || item.sector === query.sector) &&
      (!query.problem || item.problem_type === query.problem) &&
      (!query.type || item.exercise_type === query.type) &&
      (!query.difficulty || item.difficulty === query.difficulty),
  );
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="practice" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Original OfferLab materials</p>
          <h1>Group exercise case library</h1>
          <p className="intro">
            Choose from 100 fictional cases across industries, problem types and exercise formats.
            Practise the reasoning pattern; none reproduce a live employer assessment.
          </p>
        </div>
        <Link className="button-secondary button-link" href="/member/learn/practice">
          Back to rooms
        </Link>
      </section>
      <form className="group-mock-library-filters">
        <label>
          Search
          <input defaultValue={query.q ?? ""} name="q" placeholder="Case, industry or skill" />
        </label>
        <label>
          Industry
          <select defaultValue={query.sector ?? ""} name="sector">
            <option value="">All industries</option>
            {Object.entries(groupMockSectors).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Problem
          <select defaultValue={query.problem ?? ""} name="problem">
            <option value="">All problems</option>
            {Object.entries(groupMockProblemTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select defaultValue={query.type ?? ""} name="type">
            <option value="">All formats</option>
            {Object.entries(groupMockExerciseTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level
          <select defaultValue={query.difficulty ?? ""} name="difficulty">
            <option value="">All levels</option>
            {Object.entries(groupMockDifficulties).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply filters</button>
        <Link className="button-secondary button-link" href="/member/learn/practice/cases">
          Clear
        </Link>
      </form>
      <p className="cms-result-count">
        Showing {visible.length} of {cases.length} cases
      </p>
      <section className="group-mock-case-grid" aria-label="Group exercise cases">
        {visible.map((item) => (
          <article className="group-mock-case-card" key={item.id}>
            <div className="group-mock-card-badges">
              <span>{groupMockSectors[item.sector]}</span>
              <span>{groupMockProblemTypes[item.problem_type]}</span>
            </div>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
            <dl className="group-mock-case-facts">
              <div>
                <dt>Format</dt>
                <dd>{groupMockExerciseTypes[item.exercise_type]}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>{groupMockDifficulties[item.difficulty]}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{item.recommended_minutes} minutes</dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{item.recommended_group_size} people</dd>
              </div>
            </dl>
            <div className="group-mock-skill-list">
              {item.skills.map((skill) => (
                <span key={skill}>{skill.replaceAll("_", " ")}</span>
              ))}
            </div>
            <Link className="button-link" href={`/member/learn/practice/cases/${item.id}`}>
              Open case
            </Link>
          </article>
        ))}
        {!visible.length && <p className="cms-empty-inline">No cases match these filters.</p>}
      </section>
    </main>
  );
}
