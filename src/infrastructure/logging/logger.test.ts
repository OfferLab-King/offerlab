import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./logger";

describe("createLogger", () => {
  it("redacts sensitive fields", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ destination, level: "info" });

    logger.info(
      {
        notes: "private",
        token: "secret",
        url: "/auth/callback?token_hash=credential-value",
      },
      "test",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(output).not.toContain("private");
    expect(output).not.toContain("secret");
    expect(output).not.toContain("credential-value");
  });

  it("redacts every private field in a nested application object", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ destination, level: "info" });
    const sentinels = [
      "COMPANY_SENTINEL",
      "ROLE_SENTINEL",
      "OPPORTUNITY_SENTINEL",
      "INDUSTRY_SENTINEL",
      "STAGE_SENTINEL",
      "LOCATION_SENTINEL",
      "APPLICATION_DEADLINE_SENTINEL",
      "APPLIED_DATE_SENTINEL",
      "NEXT_STAGE_DEADLINE_SENTINEL",
      "NOTES_SENTINEL",
    ];

    logger.info(
      {
        application: {
          appliedDate: sentinels[7],
          applicationDeadline: sentinels[6],
          company: sentinels[0],
          industry: sentinels[3],
          location: sentinels[5],
          nextStageDeadline: sentinels[8],
          notes: sentinels[9],
          opportunityType: sentinels[2],
          role: sentinels[1],
          stage: sentinels[4],
        },
      },
      "test",
    );
    await new Promise((resolve) => setImmediate(resolve));

    for (const sentinel of sentinels) expect(output).not.toContain(sentinel);
  });

  it("redacts recommendation payloads and stage-revealing keys", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ destination, level: "info" });
    logger.info(
      {
        mutation: {
          recommendationKey: "PRIVATE_RECOMMENDATION_KEY",
          ruleVersion: "PRIVATE_RULE_VERSION",
        },
        recommendations: "PRIVATE_RECOMMENDATION_PAYLOAD",
      },
      "test",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(output).not.toContain("PRIVATE_RECOMMENDATION_KEY");
    expect(output).not.toContain("PRIVATE_RULE_VERSION");
    expect(output).not.toContain("PRIVATE_RECOMMENDATION_PAYLOAD");
  });

  it("keeps private search terms out of operational request fields", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ destination, level: "info" });
    const sentinel = "OFFERLAB_PRIVATE_SEARCH_SENTINEL_7F39";
    logger.info(
      {
        req: { query: { q: sentinel }, url: `/member/learn?q=${sentinel}` },
        request: { url: `/member/learn?q=${sentinel}` },
        searchParams: { q: sentinel },
        url: `/member/learn?q=${sentinel}`,
      },
      "library request",
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(output).not.toContain(sentinel);
  });

  it("redacts submitted CMS content and identifiers", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ destination, level: "info" });
    const cms = {
      archivedAt: "CMS_ARCHIVED_TIMESTAMP",
      categories: ["CMS_CATEGORY"],
      firstPublishedAt: "CMS_FIRST_PUBLISHED_TIMESTAMP",
      links: ["CMS_LINK"],
      markdownBody: "CMS_MARKDOWN",
      opportunityTypes: ["CMS_OPPORTUNITY"],
      publishedAt: "CMS_PUBLISHED_TIMESTAMP",
      recruitmentStages: ["CMS_STAGE"],
      relatedResources: ["CMS_RELATED_RESOURCE"],
      resourceId: "CMS_RESOURCE_UUID",
      shortDescription: "CMS_SUMMARY",
      slug: "CMS_SLUG",
      tags: ["CMS_TAG"],
      title: "CMS_TITLE",
      updatedAt: "CMS_UPDATED_TIMESTAMP",
    };

    logger.info({ cms }, "CMS request rejected");
    await new Promise((resolve) => setImmediate(resolve));

    for (const value of Object.values(cms).flat()) expect(output).not.toContain(value);
  });
});
