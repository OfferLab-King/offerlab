"use client";

import { useMemo, useState } from "react";

import { jobSubsectors, remoteTypeLabels } from "../../../modules/job-catalog/domain/taxonomy";
import type {
  CatalogFacetGroup,
  FacetOption,
  JobCatalogFilters,
} from "../../../modules/job-catalog/domain/catalog";
import { activeFilterCount } from "../../../modules/job-catalog/domain/catalog";
import type { FacetedSearchPayload } from "../../../modules/job-catalog/application/catalog";

const EMPLOYER_VISIBLE_LIMIT = 10;
const LOCATION_VISIBLE_LIMIT = 12;

type FacetSectionProps = Readonly<{
  canClear: boolean;
  children?: React.ReactNode;
  clearLabel: string;
  expanded: boolean;
  onClear: () => void;
  onToggleExpanded: () => void;
  options: readonly FacetOption[];
  renderOption: (option: FacetOption, index: number) => React.ReactNode;
  title: string;
}>;

function FacetSection({
  canClear,
  children,
  clearLabel,
  expanded,
  onClear,
  onToggleExpanded,
  options,
  renderOption,
  title,
}: FacetSectionProps) {
  return (
    <section className="catalogue-facet" aria-labelledby={`facet-${clearLabel}`}>
      <div className="catalogue-facet-heading">
        <h3 id={`facet-${clearLabel}`}>{title}</h3>
        <button
          aria-hidden={!canClear}
          className={`catalogue-facet-clear ${canClear ? "" : "is-placeholder"}`}
          disabled={!canClear}
          onClick={onClear}
          tabIndex={canClear ? 0 : -1}
          type="button"
        >
          Clear
        </button>
        <button
          aria-expanded={expanded}
          className="catalogue-facet-collapse"
          onClick={onToggleExpanded}
          type="button"
        >
          <span className="visually-hidden">
            {expanded ? "Collapse" : "Expand"} {title}
          </span>
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </div>
      {expanded && (
        <>
          <ul className="catalogue-facet-list">
            {options.map((option, index) => (
              <li className="catalogue-facet-item" key={option.value}>
                {renderOption(option, index)}
              </li>
            ))}
          </ul>
          {children}
        </>
      )}
    </section>
  );
}

function FacetChoice({
  count,
  label,
  selected,
  onToggle,
}: Readonly<{
  count?: number;
  label: string;
  onToggle: () => void;
  selected: boolean;
}>) {
  return (
    <button
      aria-pressed={selected}
      className={`catalogue-filter-choice ${selected ? "is-selected" : ""} ${count === 0 && !selected ? "is-disabled" : ""}`}
      disabled={count === 0 && !selected}
      onClick={onToggle}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="catalogue-filter-check">
        ✓
      </span>
      <span className="catalogue-filter-label">{label}</span>
      {count !== undefined && <span className="catalogue-filter-count">({count})</span>}
    </button>
  );
}

export type FacetControlGroup = CatalogFacetGroup | "deadline" | "posted" | "sort";

export function FacetSidebar({
  facets,
  filters,
  onClearAll,
  onClearGroup,
  onToggle,
}: Readonly<{
  facets: FacetedSearchPayload["facets"];
  filters: JobCatalogFilters;
  onClearAll: () => void;
  onClearGroup: (group: FacetControlGroup) => void;
  onToggle: (group: FacetControlGroup, value: string) => void;
}>) {
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({
    deadline: false,
    employers: true,
    jobTypes: true,
    locations: false,
    posted: false,
    sectors: true,
    sponsorship: false,
  });
  const [employerQuery, setEmployerQuery] = useState("");
  const [showAllEmployers, setShowAllEmployers] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [openSectors, setOpenSectors] = useState<Readonly<Record<string, boolean>>>(() => {
    const initial: Record<string, boolean> = {};
    for (const sector of facets.sectors) {
      const subsectors = jobSubsectors.filter((item) => item.sectorKey === sector.value);
      initial[sector.value] =
        filters.sectors.includes(sector.value) ||
        subsectors.some((item) => filters.subsectors.includes(item.key));
    }
    return initial;
  });

  const subsectorsBySector = useMemo(() => {
    const map = new Map<string, FacetOption[]>();
    for (const option of facets.subsectors) {
      const subsector = jobSubsectors.find((item) => item.key === option.value);
      const sectorKey = subsector?.sectorKey;
      if (!sectorKey) continue;
      const list = map.get(sectorKey) ?? [];
      list.push(option);
      map.set(sectorKey, list);
    }
    return map;
  }, [facets.subsectors]);

  const matchingEmployers = useMemo(() => {
    const query = employerQuery.trim().toLowerCase();
    if (!query) return facets.employers;
    return facets.employers.filter((employer) => employer.label.toLowerCase().includes(query));
  }, [employerQuery, facets.employers]);

  const visibleEmployers = useMemo(() => {
    if (showAllEmployers) return matchingEmployers;
    const selected = matchingEmployers.filter((employer) =>
      filters.employers.includes(employer.value),
    );
    const top = matchingEmployers
      .filter((employer) => !filters.employers.includes(employer.value))
      .slice(0, EMPLOYER_VISIBLE_LIMIT);
    return [...top, ...selected];
  }, [matchingEmployers, showAllEmployers, filters.employers]);

  const toggleExpanded = (key: string): void => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <aside aria-label="Filters" className="catalogue-sidebar">
      <div className="catalogue-sidebar-header">
        <h2>Filters</h2>
        <button
          aria-hidden={activeFilterCount(filters) === 0}
          className={`catalogue-facet-clear ${activeFilterCount(filters) > 0 ? "" : "is-placeholder"}`}
          disabled={activeFilterCount(filters) === 0}
          onClick={onClearAll}
          tabIndex={activeFilterCount(filters) > 0 ? 0 : -1}
          type="button"
        >
          Clear all
        </button>
      </div>

      <section className="catalogue-facet catalogue-sector-filter" aria-labelledby="facet-sectors">
        <div className="catalogue-facet-heading">
          <h3 id="facet-sectors">Sectors</h3>
          <span aria-hidden="true" />
          <button
            aria-expanded={expanded.sectors ?? true}
            className="catalogue-facet-collapse"
            onClick={() => toggleExpanded("sectors")}
            type="button"
          >
            <span className="visually-hidden">
              {expanded.sectors ? "Collapse" : "Expand"} Sectors
            </span>
            <span aria-hidden="true">{expanded.sectors ? "−" : "+"}</span>
          </button>
        </div>
        {(expanded.sectors ?? true) && (
          <ul className="catalogue-sector-menu">
            <li>
              <button
                className={`catalogue-sector-choice ${filters.sectors.length === 0 && filters.subsectors.length === 0 ? "is-selected" : ""}`}
                onClick={() => {
                  onClearGroup("sectors");
                  onClearGroup("subsectors");
                }}
                type="button"
              >
                <span aria-hidden="true" className="catalogue-sector-check">
                  ✓
                </span>
                <span>All sectors</span>
              </button>
            </li>
            {facets.sectors.map((sector) => {
              const subsectorOptions = subsectorsBySector.get(sector.value) ?? [];
              const isOpen = openSectors[sector.value] ?? false;
              const sectorSelected = filters.sectors.includes(sector.value);
              return (
                <li className="catalogue-sector-group" key={sector.value}>
                  <button
                    aria-expanded={isOpen}
                    aria-label={`${sector.label}, ${sector.count} ${sector.count === 1 ? "role" : "roles"}, ${isOpen ? "collapse" : "expand"}`}
                    className="catalogue-sector-row"
                    onClick={() =>
                      setOpenSectors((current) => ({
                        ...current,
                        [sector.value]: !isOpen,
                      }))
                    }
                    title={sector.label}
                    type="button"
                  >
                    <span className="catalogue-sector-name">{sector.label}</span>
                    <span className="catalogue-sector-row-count">({sector.count})</span>
                    <span
                      aria-hidden="true"
                      className={`catalogue-sector-chevron ${isOpen ? "is-open" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <ul className="catalogue-sector-children">
                      <li>
                        <button
                          className={`catalogue-sector-choice ${sectorSelected ? "is-selected" : ""}`}
                          onClick={() => onToggle("sectors", sector.value)}
                          type="button"
                        >
                          <span aria-hidden="true" className="catalogue-sector-check">
                            ✓
                          </span>
                          <span>All {sector.label}</span>
                          <span className="catalogue-sector-choice-count">({sector.count})</span>
                        </button>
                      </li>
                      {subsectorOptions.map((subsector) => {
                        const selected = filters.subsectors.includes(subsector.value);
                        return (
                          <li key={subsector.value}>
                            <button
                              className={`catalogue-sector-choice ${selected ? "is-selected" : ""}`}
                              onClick={() => onToggle("subsectors", subsector.value)}
                              title={subsector.label}
                              type="button"
                            >
                              <span aria-hidden="true" className="catalogue-sector-check">
                                ✓
                              </span>
                              <span>{subsector.label}</span>
                              <span className="catalogue-sector-choice-count">
                                ({subsector.count})
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FacetSection
        canClear={filters.industries.length > 0}
        clearLabel="industries"
        expanded={expanded.industries ?? true}
        onClear={() => onClearGroup("industries")}
        onToggleExpanded={() => toggleExpanded("industries")}
        options={facets.industries}
        renderOption={(option) => (
          <FacetChoice
            count={option.count}
            label={option.label ?? option.value.replaceAll("_", " ")}
            onToggle={() => onToggle("industries", option.value)}
            selected={filters.industries.includes(option.value)}
          />
        )}
        title="Employer industry"
      />

      <FacetSection
        canClear={filters.functions.length > 0}
        clearLabel="functions"
        expanded={expanded.functions ?? true}
        onClear={() => onClearGroup("functions")}
        onToggleExpanded={() => toggleExpanded("functions")}
        options={facets.functions}
        renderOption={(option) => (
          <FacetChoice
            count={option.count}
            label={option.label ?? option.value.replaceAll("_", " ")}
            onToggle={() => onToggle("functions", option.value)}
            selected={filters.functions.includes(option.value)}
          />
        )}
        title="Job function"
      />

      <div className="catalogue-facet">
        <div className="catalogue-facet-heading">
          <h3>Employers</h3>
          <button
            aria-hidden={filters.employers.length === 0}
            className={`catalogue-facet-clear ${filters.employers.length > 0 ? "" : "is-placeholder"}`}
            disabled={filters.employers.length === 0}
            onClick={() => onClearGroup("employers")}
            tabIndex={filters.employers.length > 0 ? 0 : -1}
            type="button"
          >
            Clear
          </button>
        </div>
        <label className="visually-hidden" htmlFor="employer-facet-search">
          Search employers
        </label>
        <input
          className="catalogue-facet-search"
          id="employer-facet-search"
          onChange={(event) => setEmployerQuery(event.currentTarget.value)}
          placeholder="Search employers"
          type="search"
          value={employerQuery}
        />
        {visibleEmployers.length > 0 && (
          <ul className="catalogue-facet-list">
            {visibleEmployers.map((employer) => (
              <li className="catalogue-facet-item" key={employer.value}>
                <FacetChoice
                  count={employer.count}
                  label={employer.label}
                  onToggle={() => onToggle("employers", employer.value)}
                  selected={filters.employers.includes(employer.value)}
                />
              </li>
            ))}
          </ul>
        )}
        {matchingEmployers.length > EMPLOYER_VISIBLE_LIMIT && (
          <button
            className="catalogue-facet-more"
            onClick={() => setShowAllEmployers((v) => !v)}
            type="button"
          >
            {showAllEmployers ? "Show fewer" : `Show more (${matchingEmployers.length})`}
          </button>
        )}
      </div>

      <FacetSection
        canClear={filters.locations.length > 0}
        clearLabel="locations"
        expanded={expanded.locations ?? true}
        onClear={() => onClearGroup("locations")}
        onToggleExpanded={() => toggleExpanded("locations")}
        options={facets.locations}
        renderOption={(location, index) =>
          index < (showAllLocations ? facets.locations.length : LOCATION_VISIBLE_LIMIT) ? (
            <FacetChoice
              count={location.count}
              label={location.label}
              onToggle={() => onToggle("locations", location.value)}
              selected={filters.locations.includes(location.value)}
            />
          ) : null
        }
        title="Locations"
      />
      {facets.locations.length > LOCATION_VISIBLE_LIMIT && (
        <button
          className="catalogue-facet-more"
          onClick={() => setShowAllLocations((v) => !v)}
          type="button"
        >
          {showAllLocations ? "Show fewer" : `Show more (${facets.locations.length})`}
        </button>
      )}

      <FacetSection
        canClear={filters.workModes.length > 0}
        clearLabel="workmodes"
        expanded={expanded.workModes ?? true}
        onClear={() => onClearGroup("workModes")}
        onToggleExpanded={() => toggleExpanded("workModes")}
        options={facets.workModes}
        renderOption={(mode) => (
          <FacetChoice
            count={mode.count}
            label={remoteTypeLabels[mode.value as keyof typeof remoteTypeLabels] ?? mode.value}
            onToggle={() => onToggle("workModes", mode.value)}
            selected={filters.workModes.includes(mode.value)}
          />
        )}
        title="Work arrangement"
      />

      <FacetSection
        canClear={filters.jobTypes.length > 0}
        clearLabel="jobtypes"
        expanded={expanded.jobTypes ?? true}
        onClear={() => onClearGroup("jobTypes")}
        onToggleExpanded={() => toggleExpanded("jobTypes")}
        options={facets.jobTypes}
        renderOption={(type) => (
          <FacetChoice
            count={type.count}
            label={type.label}
            onToggle={() => onToggle("jobTypes", type.value)}
            selected={filters.jobTypes.includes(type.value)}
          />
        )}
        title="Job types"
      />

      <FacetSection
        canClear={filters.levels.length > 0}
        clearLabel="levels"
        expanded={expanded.levels ?? true}
        onClear={() => onClearGroup("levels")}
        onToggleExpanded={() => toggleExpanded("levels")}
        options={facets.levels}
        renderOption={(option) => (
          <FacetChoice
            count={option.count}
            label={option.label ?? option.value.replaceAll("_", " ")}
            onToggle={() => onToggle("levels", option.value)}
            selected={filters.levels.includes(option.value)}
          />
        )}
        title="Career level"
      />

      <FacetSection
        canClear={filters.sponsorship.length > 0}
        clearLabel="sponsorship"
        expanded={expanded.sponsorship ?? true}
        onClear={() => onClearGroup("sponsorship")}
        onToggleExpanded={() => toggleExpanded("sponsorship")}
        options={facets.sponsorship}
        renderOption={(option) => (
          <FacetChoice
            count={option.count}
            label={option.label}
            onToggle={() => onToggle("sponsorship", option.value)}
            selected={filters.sponsorship.includes(option.value)}
          />
        )}
        title="Role sponsorship"
      />

      <FacetSection
        canClear={filters.sponsorLicence}
        clearLabel="sponsorlicence"
        expanded={expanded.sponsorLicence ?? true}
        onClear={() => onClearGroup("sponsorLicence")}
        onToggleExpanded={() => toggleExpanded("sponsorLicence")}
        options={facets.sponsorLicence}
        renderOption={(option) => (
          <FacetChoice
            count={option.count}
            label={option.label ?? "Employer is a UK licensed sponsor"}
            onToggle={() => onToggle("sponsorLicence", option.value)}
            selected={filters.sponsorLicence}
          />
        )}
        title="Employer sponsor licence"
      />

      <FacetSection
        canClear={filters.deadline !== "any"}
        clearLabel="deadline"
        expanded={expanded.deadline ?? true}
        onClear={() => onClearGroup("deadline")}
        onToggleExpanded={() => toggleExpanded("deadline")}
        options={[]}
        renderOption={() => null}
        title="Deadline"
      >
        <ul className="catalogue-facet-list">
          {(
            [
              { label: "Any", value: "any" },
              { label: "Upcoming", value: "upcoming" },
              { label: "No deadline listed", value: "none" },
            ] as const
          ).map((option) => (
            <li className="catalogue-facet-item" key={option.value}>
              <FacetChoice
                label={option.label}
                onToggle={() => onToggle("deadline", option.value)}
                selected={filters.deadline === option.value}
              />
            </li>
          ))}
        </ul>
      </FacetSection>

      <FacetSection
        canClear={filters.postedWithinDays !== null}
        clearLabel="posted"
        expanded={expanded.posted ?? true}
        onClear={() => onClearGroup("posted")}
        onToggleExpanded={() => toggleExpanded("posted")}
        options={[]}
        renderOption={() => null}
        title="Posted"
      >
        <ul className="catalogue-facet-list">
          {(
            [
              { label: "Any time", value: "" },
              { label: "Last 7 days", value: "7" },
              { label: "Last 14 days", value: "14" },
              { label: "Last 30 days", value: "30" },
            ] as const
          ).map((option) => (
            <li className="catalogue-facet-item" key={option.value || "any"}>
              <FacetChoice
                label={option.label}
                onToggle={() => onToggle("posted", option.value)}
                selected={(filters.postedWithinDays ?? "").toString() === option.value}
              />
            </li>
          ))}
        </ul>
      </FacetSection>
    </aside>
  );
}
