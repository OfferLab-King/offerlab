import { describe, expect, it } from "vitest";

import { escapeJsonLd } from "../../../modules/job-catalog/domain/publication";
import { jobDetailFixture, thinJobFixture } from "./job-detail-fixtures";
import { buildJobStructuredData } from "./job-structured-data";

const now = new Date("2026-08-10T00:00:00Z");
const baseUrl = "https://offerlab.example.com";

function posting(overrides: Parameters<typeof jobDetailFixture>[0] = {}) {
  const nodes = buildJobStructuredData(jobDetailFixture(overrides), now, baseUrl)!;
  const jobPosting = nodes.find((node) => node["@type"] === "JobPosting")!;
  const breadcrumb = nodes.find((node) => node["@type"] === "BreadcrumbList")!;
  return { breadcrumb, jobPosting, nodes };
}

describe("job structured data", () => {
  it("emits nothing for a role that fails the indexability policy", () => {
    expect(buildJobStructuredData(thinJobFixture(), now, baseUrl)).toBeNull();
    expect(
      buildJobStructuredData(jobDetailFixture({ publication_status: "draft" }), now, baseUrl),
    ).toBeNull();
    expect(
      buildJobStructuredData(
        jobDetailFixture({ application_deadline: new Date("2020-01-01T00:00:00Z") }),
        now,
        baseUrl,
      ),
    ).toBeNull();
  });

  it("emits a JobPosting with the canonical URL and a BreadcrumbList for an indexable role", () => {
    const { breadcrumb, jobPosting, nodes } = posting();
    expect(nodes).toHaveLength(2);
    expect(jobPosting["@context"]).toBe("https://schema.org");
    expect(jobPosting.url).toBe("https://offerlab.example.com/jobs/example-bank-graduate-analyst");
    expect(jobPosting.title).toBe("Graduate Analyst");
    expect(jobPosting.datePosted).toBe("2026-08-01T00:00:00.000Z");
    expect(jobPosting.validThrough).toBe("2026-12-01T00:00:00.000Z");
    const items = breadcrumb.itemListElement as Array<{ name: string; position: number }>;
    expect(items.map((item) => item.name)).toEqual(["Jobs", "Graduate Analyst"]);
  });

  it("emits no JobPosting when the employer's original posting date is unknown", () => {
    expect(buildJobStructuredData(jobDetailFixture({ posted_at: null }), now, baseUrl)).toBeNull();
  });

  it("omits validThrough when no deadline is stored", () => {
    const { jobPosting } = posting({ application_deadline: null });
    expect(jobPosting.validThrough).toBeUndefined();
  });

  it("maps stored employment types to Schema.org enums and omits unknown", () => {
    expect(posting({ employment_type: "full_time" }).jobPosting.employmentType).toBe("FULL_TIME");
    expect(posting({ employment_type: "part_time" }).jobPosting.employmentType).toBe("PART_TIME");
    expect(posting({ employment_type: "contract" }).jobPosting.employmentType).toBe("CONTRACTOR");
    expect(posting({ employment_type: "internship" }).jobPosting.employmentType).toBe("INTERN");
    expect(posting({ employment_type: "graduate_programme" }).jobPosting.employmentType).toBe(
      "OTHER",
    );
    expect(posting({ employment_type: "unknown" }).jobPosting.employmentType).toBeUndefined();
    expect(posting({ employment_type: null }).jobPosting.employmentType).toBeUndefined();
  });

  it("emits verified employer URL and logo on the hiring organization", () => {
    const organization = posting().jobPosting.hiringOrganization as Record<string, unknown>;
    expect(organization["@type"]).toBe("Organization");
    expect(organization.name).toBe("Example Bank");
    expect(organization.url).toBe("https://employer.example.com");
    expect(organization.logo).toBe("https://employer.example.com/logo.png");
  });

  it("falls back to the careers URL when no website URL is stored", () => {
    const organization = posting({ company_website_url: null }).jobPosting
      .hiringOrganization as Record<string, unknown>;
    expect(organization.url).toBe("https://employer.example.com/careers");
  });

  it("emits PostalAddress locations from structured evidence", () => {
    const location = posting().jobPosting.jobLocation as {
      address: Record<string, string>;
      "@type": string;
    };
    expect(location["@type"]).toBe("Place");
    expect(location.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "United Kingdom",
      addressLocality: "London",
      addressRegion: "London",
    });
  });

  it("emits an array of Places for multiple structured locations", () => {
    const { jobPosting } = posting({
      locations: [
        {
          city: "London",
          country: "United Kingdom",
          hybrid: false,
          on_site: true,
          region: null,
          remote: false,
          source_text: "London",
        },
        {
          city: "Manchester",
          country: "United Kingdom",
          hybrid: false,
          on_site: true,
          region: null,
          remote: false,
          source_text: "Manchester",
        },
      ],
    });
    const locations = jobPosting.jobLocation as Array<{ address: Record<string, string> }>;
    expect(locations).toHaveLength(2);
    expect(locations.map((item) => item.address.addressLocality)).toEqual(["London", "Manchester"]);
  });

  it("omits jobLocation when no country-backed structured location exists", () => {
    expect(posting({ locations: [] }).jobPosting.jobLocation).toBeUndefined();
  });

  it("emits TELECOMMUTE only with verified applicant-country evidence", () => {
    const unsupported = posting({ locations: [], location_text: null, remote_type: "remote" });
    expect(unsupported.jobPosting.jobLocation).toBeUndefined();
    expect(unsupported.jobPosting.jobLocationType).toBeUndefined();
    expect(unsupported.jobPosting.applicantLocationRequirements).toBeUndefined();

    const supported = posting({
      locations: [
        {
          city: null,
          country: "United Kingdom",
          hybrid: false,
          on_site: false,
          region: null,
          remote: true,
          source_text: "Remote, United Kingdom",
        },
      ],
      location_text: "Remote, United Kingdom",
      remote_type: "remote",
    });
    expect(supported.jobPosting.jobLocation).toBeUndefined();
    expect(supported.jobPosting.jobLocationType).toBe("TELECOMMUTE");
    expect(supported.jobPosting.applicantLocationRequirements).toEqual({
      "@type": "Country",
      name: "United Kingdom",
    });

    const onSite = posting({ remote_type: "on_site" });
    expect(onSite.jobPosting.jobLocationType).toBeUndefined();

    const hybrid = posting({ locations: [], location_text: null, remote_type: "hybrid" });
    expect(hybrid.jobPosting.jobLocation).toBeUndefined();
  });

  it("emits salary only with verified amount, currency and period", () => {
    const salary = posting().jobPosting.baseSalary as Record<string, unknown>;
    expect(salary["@type"]).toBe("MonetaryAmount");
    expect(salary.currency).toBe("GBP");
    expect(salary.value).toEqual({
      "@type": "QuantitativeValue",
      maxValue: 35_000,
      minValue: 30_000,
      unitText: "YEAR",
    });
  });

  it("omits salary when amount, currency or period evidence is missing", () => {
    expect(posting({ salary_min: null, salary_max: null }).jobPosting.baseSalary).toBeUndefined();
    expect(posting({ salary_currency: null }).jobPosting.baseSalary).toBeUndefined();
    expect(posting({ salary_period: "unknown" }).jobPosting.baseSalary).toBeUndefined();
  });

  it("normalizes an ISO currency code and rejects non-code currency labels", () => {
    const normalized = posting({ salary_currency: "gbp" }).jobPosting.baseSalary as Record<
      string,
      unknown
    >;
    expect(normalized.currency).toBe("GBP");
    expect(posting({ salary_currency: "£" }).jobPosting.baseSalary).toBeUndefined();
  });

  it("uses the slug as the stable identifier and never exposes internal ids", () => {
    const identifier = posting().jobPosting.identifier as Record<string, unknown>;
    expect(identifier).toEqual({
      "@type": "PropertyValue",
      name: "Example Bank",
      value: "example-bank-graduate-analyst",
    });
    expect(JSON.stringify(posting().jobPosting)).not.toContain(
      "30000000-0000-4000-8000-000000000002",
    );
    expect(JSON.stringify(posting().jobPosting)).not.toContain("req-123");
  });

  it("never emits empty strings and escapes safely for the script tag", () => {
    const { nodes } = posting();
    const text = escapeJsonLd(nodes);
    expect(text).not.toContain('""');
    expect(text).not.toContain("<");
    expect(text).not.toContain("&");
    expect(JSON.parse(text)).toEqual(nodes);
  });

  it("emits no JobPosting when no visible substantive description exists", () => {
    expect(
      buildJobStructuredData(
        jobDetailFixture({
          description_summary: null,
          experience_requirements: null,
          preferred_skills: [],
          responsibilities: [],
          requirements: [],
          skills: [],
          degree_requirements: [],
        }),
        now,
        baseUrl,
      ),
    ).toBeNull();
    expect(hasNull([posting().nodes])).toBe(false);
  });

  it("keeps a script-breaking title safely escaped in the emitted JSON-LD", () => {
    const nodes = buildJobStructuredData(
      jobDetailFixture({
        normalized_title: 'Graduate <script>alert("x")</script> Analyst',
        title: 'Graduate <script>alert("x")</script> Analyst',
      }),
      now,
      baseUrl,
    )!;
    const text = escapeJsonLd(nodes);
    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
    expect(parsed[0]!.title).toBe('Graduate <script>alert("x")</script> Analyst');
  });
});

function hasNull(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.some((item) => hasNull(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasNull(item));
  }
  return false;
}
