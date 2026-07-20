import { describe, expect, it } from "vitest";

import { APPLICATION_JSON_BODY_LIMIT_BYTES, readApplicationJson } from "./request";

describe("application JSON request boundary", () => {
  it("accepts bounded JSON", async () => {
    const request = new Request("http://localhost/api/member/applications", {
      body: JSON.stringify({ company: "Example" }),
      headers: { "content-type": "application/json; charset=utf-8" },
      method: "POST",
    });
    await expect(readApplicationJson(request)).resolves.toMatchObject({ ok: true });
  });

  it("rejects malformed JSON, unsupported content types, and oversized requests", async () => {
    const malformed = new Request("http://localhost", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    await expect(readApplicationJson(malformed)).resolves.toEqual({ ok: false, status: 400 });
    const text = new Request("http://localhost", {
      body: "value",
      headers: { "content-type": "text/plain" },
      method: "POST",
    });
    await expect(readApplicationJson(text)).resolves.toEqual({ ok: false, status: 415 });
    const oversized = new Request("http://localhost", {
      body: JSON.stringify({ notes: "x".repeat(APPLICATION_JSON_BODY_LIMIT_BYTES) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    await expect(readApplicationJson(oversized)).resolves.toEqual({ ok: false, status: 413 });
  });
});
