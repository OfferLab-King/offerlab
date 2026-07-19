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

    logger.info({ notes: "private", token: "secret" }, "test");
    await new Promise((resolve) => setImmediate(resolve));

    expect(output).not.toContain("private");
    expect(output).not.toContain("secret");
  });
});
