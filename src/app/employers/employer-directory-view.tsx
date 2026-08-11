"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  jobSectors,
  jobSubsectors,
  type JobSectorKey,
} from "../../modules/job-catalog/domain/taxonomy";
import { keyToSlug } from "../../modules/job-catalog/domain/catalog";
import type { SectorCountRow } from "../../modules/job-catalog/application/catalog";
import type { EmployerDirectoryRow } from "../../modules/job-catalog/infrastructure/catalog-repository";

const SECTOR_VISIBLE_LIMIT = 10;

type SectorGroup = Readonly<{
  employers: readonly EmployerDirectoryRow[];
  label: string;
  roleCount: number;
  sectorKey: string | null;
  subsectorCounts: ReadonlyMap<string, number>;
}>;

const EMPTY_GROUP_LABEL = "Other";

export function EmployerDirectoryView({
  rows,
  sectorCounts,
}: Readonly<{
  rows: readonly EmployerDirectoryRow[];
  sectorCounts: readonly SectorCountRow[];
}>) {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>(() => {
    const initial: Record<string, boolean> = {};
    for (const sector of jobSectors) initial[sector.key] = true;
    initial.unclassified = true;
    return initial;
  });
  const [visible, setVisible] = useState<Readonly<Record<string, number>>>({});

  const groups = useMemo<SectorGroup[]>(() => {
    const bySector = new Map<string, EmployerDirectoryRow[]>();
    for (const row of rows) {
      const key = row.sector_key ?? "unclassified";
      const list = bySector.get(key) ?? [];
      list.push(row);
      bySector.set(key, list);
    }
    const result: SectorGroup[] = [];
    for (const sector of jobSectors) {
      const employers = bySector.get(sector.key) ?? [];
      if (employers.length === 0) continue;
      const counts = new Map(
        sectorCounts
          .filter((row) => row.sector_key === sector.key && row.subsector_key)
          .map((row) => [row.subsector_key!, row.count] as const),
      );
      result.push({
        employers,
        label: sector.displayName,
        roleCount: [...counts.values()].reduce((sum, count) => sum + count, 0),
        sectorKey: sector.key,
        subsectorCounts: counts,
      });
    }
    const unclassified = bySector.get("unclassified");
    if (unclassified && unclassified.length > 0) {
      result.push({
        employers: unclassified,
        label: EMPTY_GROUP_LABEL,
        roleCount: unclassified.reduce((sum, employer) => sum + employer.active_count, 0),
        sectorKey: null,
        subsectorCounts: new Map(),
      });
    }
    return result;
  }, [rows, sectorCounts]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        employers: group.employers.filter((employer) => {
          const nameMatch = normalizedQuery
            ? employer.company_name.toLowerCase().includes(normalizedQuery)
            : true;
          const letterMatch = letter
            ? employer.company_name.toLowerCase().startsWith(letter.toLowerCase())
            : true;
          return nameMatch && letterMatch;
        }),
      }))
      .filter((group) => group.employers.length > 0);
  }, [groups, letter, query]);

  const alphabet = useMemo(() => {
    const letters = new Set<string>();
    for (const row of rows) {
      const initial = row.company_name.charAt(0).toUpperCase();
      if (/[A-Z]/u.test(initial)) letters.add(initial);
    }
    return [...letters].sort();
  }, [rows]);

  const toggleSector = (key: string): void => {
    setExpanded((current) => ({ ...current, [key]: !(current[key] ?? true) }));
  };

  return (
    <div className="employer-directory">
      <div className="employer-directory-controls">
        <label className="employer-directory-search">
          <span className="visually-hidden">Search employers</span>
          <input
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search employers"
            type="search"
            value={query}
          />
        </label>
        {alphabet.length > 0 && (
          <nav aria-label="Employers by initial" className="employer-directory-alphabet">
            <button
              aria-pressed={letter === null}
              className={`employer-directory-clear ${letter === null ? "is-active" : ""}`}
              onClick={() => setLetter(null)}
              type="button"
            >
              All
            </button>
            {alphabet.map((item) => (
              <button
                aria-pressed={letter === item}
                className={letter === item ? "is-active" : ""}
                key={item}
                onClick={() => setLetter(letter === item ? null : item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
        )}
      </div>

      {filtered.length === 0 ? (
        <section className="job-catalog-empty">
          <h2>No employers match</h2>
          <p>Try a different search or initial.</p>
          <button
            className="button-link"
            onClick={() => {
              setQuery("");
              setLetter(null);
            }}
            type="button"
          >
            Clear search
          </button>
        </section>
      ) : (
        filtered.map((group) => {
          const isExpanded = expanded[group.sectorKey ?? "unclassified"] ?? true;
          const limit = visible[group.sectorKey ?? "unclassified"] ?? SECTOR_VISIBLE_LIMIT;
          const employers = isExpanded ? group.employers.slice(0, limit) : [];
          return (
            <section
              className="employer-sector"
              id={`sector-${group.sectorKey ?? "other"}`}
              key={group.sectorKey ?? "unclassified"}
            >
              <h2 className="employer-sector-heading">
                <button
                  aria-expanded={isExpanded}
                  className="employer-sector-title"
                  onClick={() => toggleSector(group.sectorKey ?? "unclassified")}
                  type="button"
                >
                  {group.label}
                </button>
                <span className="employer-sector-count">
                  {group.employers.length} {group.employers.length === 1 ? "employer" : "employers"}
                </span>
                <button
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.label}`}
                  className="employer-sector-toggle"
                  onClick={() => toggleSector(group.sectorKey ?? "unclassified")}
                  type="button"
                >
                  <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                </button>
              </h2>
              {isExpanded && (
                <>
                  {group.sectorKey && (
                    <nav
                      aria-label={`${group.label} job areas`}
                      className="employer-sector-job-links"
                    >
                      <Link href={`/jobs?sectors=${keyToSlug(group.sectorKey as never)}` as never}>
                        All current roles{group.roleCount > 0 ? ` (${group.roleCount})` : ""}
                      </Link>
                      {jobSubsectors
                        .filter(
                          (subsector) =>
                            subsector.sectorKey === group.sectorKey &&
                            (group.subsectorCounts.get(subsector.key) ?? 0) > 0,
                        )
                        .map((subsector) => (
                          <Link
                            href={`/jobs?subsectors=${keyToSlug(subsector.key as never)}` as never}
                            key={subsector.key}
                          >
                            {subsector.displayName} ({group.subsectorCounts.get(subsector.key)})
                          </Link>
                        ))}
                    </nav>
                  )}
                  <ul className="employer-grid">
                    {employers.map((employer) => (
                      <li className="employer-grid-cell" key={employer.company_slug}>
                        <Link
                          className="employer-grid-name"
                          href={`/employers/${employer.company_slug}` as never}
                          title={employer.company_name}
                        >
                          {employer.company_name}
                        </Link>
                        <span className="employer-grid-count">
                          {employer.active_count > 0
                            ? `(${employer.active_count})`
                            : "No current roles"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {group.employers.length > limit && (
                    <button
                      className="catalogue-facet-more"
                      onClick={() =>
                        setVisible((current) => ({
                          ...current,
                          [group.sectorKey ?? "unclassified"]: isExpanded
                            ? limit + SECTOR_VISIBLE_LIMIT
                            : SECTOR_VISIBLE_LIMIT,
                        }))
                      }
                      type="button"
                    >
                      Show more ({group.employers.length - limit})
                    </button>
                  )}
                </>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export type { JobSectorKey };
