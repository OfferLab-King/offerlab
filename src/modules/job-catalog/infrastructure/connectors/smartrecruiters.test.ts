import { afterEach, describe, expect, it, vi } from "vitest";

import { createSmartRecruitersConnector, smartRecruitersSectionsToText } from "./smartrecruiters";
import {
  readFixture,
  stubContext,
  stubFetchResponses,
  stubHttpClient,
  stubRobotsGate,
} from "./test-helpers";
import type { ConnectorContext } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function context(): ConnectorContext {
  return {
    ...stubContext({ configuration: { smartRecruitersCompany: "Wise" } }),
    company: stubContext({ configuration: { smartRecruitersCompany: "Wise" } }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("SmartRecruiters connector", () => {
  it("combines list and detail payloads", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("smartrecruiters-list.json") },
      { body: await readFixture("smartrecruiters-detail.json") },
      { body: "{}", status: 404 },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createSmartRecruitersConnector().discoverJobs(context());

    expect(jobs).toHaveLength(2);
    const risk = jobs[0]!;
    expect(risk.title).toBe("Graduate Risk Analyst");
    expect(risk.externalJobId).toBe("a1b2c3d4-1111-2222-3333-444455556666");
    expect(risk.locationText).toBe("London, United Kingdom");
    expect(risk.employmentType).toBe("full_time");
    expect(risk.descriptionText).toContain("Wise moves money");
    expect(risk.descriptionText).toContain("Support risk frameworks");
    expect(risk.applicationUrl).toContain("jobs.smartrecruiters.com");

    const remote = jobs[1]!;
    expect(remote.remoteType).toBe("remote");
    expect(remote.descriptionText).toBe("");
  });

  it("fails cleanly when the company token is missing", async () => {
    const bare = context();
    await expect(
      createSmartRecruitersConnector().discoverJobs({
        ...bare,
        company: { ...bare.company, configuration: {} },
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("smartRecruitersSectionsToText", () => {
  it("reads the object-form sections returned by Wise (keyed sections with text)", () => {
    const sections = {
      companyDescription: {
        title: "Company Description",
        text: "<p>Wise is a global company.</p>",
      },
      jobDescription: {
        title: "Job Description",
        text: "<p>Build the best way to move money.</p>",
      },
      qualifications: { title: "Qualifications", text: "<p>Some experience.</p>" },
      additionalInformation: { title: "Additional Information", text: "<p>More info.</p>" },
    };
    expect(smartRecruitersSectionsToText(sections)).toBe(
      "<p>Wise is a global company.</p>\n<p>Build the best way to move money.</p>\n<p>Some experience.</p>\n<p>More info.</p>",
    );
  });

  it("still reads the array-form sections (title with content)", () => {
    const sections = [
      { title: "About us", content: "<p>Wise moves money around the world.</p>" },
      { title: "Requirements", content: "<p>Support risk frameworks.</p>" },
    ];
    expect(smartRecruitersSectionsToText(sections)).toBe(
      "<p>Wise moves money around the world.</p>\n<p>Support risk frameworks.</p>",
    );
  });

  it("returns an empty string when sections are absent", () => {
    expect(smartRecruitersSectionsToText(undefined)).toBe("");
  });

  it.each([["a string"], [42], [["not an object"]]])(
    "reports parser_changed instead of a raw TypeError for malformed sections %s",
    (malformed) => {
      expect(() => smartRecruitersSectionsToText(malformed)).toThrow(
        expect.objectContaining({ code: "parser_changed" }),
      );
    },
  );
});
