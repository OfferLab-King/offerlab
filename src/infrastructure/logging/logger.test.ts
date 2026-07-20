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
});
