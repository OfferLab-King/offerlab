import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  mutate: vi.fn(),
  sameOrigin: vi.fn(),
}));

vi.mock("../../src/app/api/member/applications/access", () => ({
  applicationApiOwner: mocks.access,
  genericApplicationError: { message: "generic" },
}));
vi.mock("../../src/modules/identity-access/application/request-security", () => ({
  hasSameOrigin: mocks.sameOrigin,
}));
vi.mock("../../src/modules/recommendations/application/recommendations", () => ({
  mutateRecommendationState: mocks.mutate,
}));

import { POST } from "../../src/app/api/member/applications/[applicationId]/recommendations/route";

const applicationId = "10000000-0000-4000-8000-000000000001";
const valid = {
  expectedVersion: null,
  recommendationKey: "interview_prepare_evidence_examples",
  ruleVersion: 1,
  targetState: "completed",
} as const;

function request(body: unknown = valid, contentType = "application/json"): Request {
  return new Request(`http://localhost/api/member/applications/${applicationId}/recommendations`, {
    body: JSON.stringify(body),
    headers: { "content-type": contentType, origin: "http://localhost" },
    method: "POST",
  });
}

function context(id = applicationId) {
  return { params: Promise.resolve({ applicationId: id }) };
}

describe("recommendation mutation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sameOrigin.mockReturnValue(true);
    mocks.access.mockResolvedValue({ ownerId: "server-owner" });
    mocks.mutate.mockResolvedValue({ outcome: "completed", stateVersion: 1 });
  });

  it("uses only the authenticated owner and returns a minimal committed result", async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      outcome: "completed",
      stateVersion: 1,
    });
    expect(mocks.mutate).toHaveBeenCalledWith("server-owner", applicationId, valid);
  });

  it.each(["conflict", "not_applicable"] as const)(
    "returns an allow-listed generic %s response",
    async (outcome) => {
      mocks.mutate.mockResolvedValue({
        applicationId: "PRIVATE_APPLICATION_ID",
        currentState: "PRIVATE_STATE",
        currentVersion: 99,
        outcome,
        recommendationKey: "PRIVATE_RECOMMENDATION_KEY",
        stateId: "PRIVATE_STATE_ID",
      });
      const response = await POST(request(), context());
      const text = await response.text();
      expect(response.status).toBe(409);
      expect(JSON.parse(text)).toEqual({ ok: true, outcome });
      for (const privateValue of [
        "PRIVATE_APPLICATION_ID",
        "PRIVATE_STATE",
        "PRIVATE_RECOMMENDATION_KEY",
        "PRIVATE_STATE_ID",
        "currentVersion",
      ]) {
        expect(text).not.toContain(privateValue);
      }
    },
  );

  it.each([
    ["invalid catalogue identity", { ...valid, ruleVersion: 0 }, 422],
    ["unexpected owner", { ...valid, ownerId: "forged-owner" }, 422],
    ["unexpected timestamp", { ...valid, completedAt: new Date().toISOString() }, 422],
    ["unsupported media type", valid, 415, "text/plain"],
  ] as const)(
    "rejects %s",
    async (_name, body, status, contentType: string = "application/json") => {
      const response = await POST(request(body, contentType), context());
      expect(response.status).toBe(status);
      expect(mocks.mutate).not.toHaveBeenCalled();
    },
  );

  it("enforces same-origin and completed-member access", async () => {
    mocks.sameOrigin.mockReturnValueOnce(false);
    expect((await POST(request(), context())).status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();

    mocks.access.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ message: "generic" }), { status: 403 }),
    });
    expect((await POST(request(), context())).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{", "application/json"],
    ["oversized JSON", JSON.stringify({ padding: "x".repeat(9_000) }), "application/json"],
    ["unsupported media", "plain", "text/plain"],
    ["unknown fields", JSON.stringify({ ...valid, ownerId: "forged" }), "application/json"],
  ])(
    "authorizes before inspecting an unauthenticated %s body",
    async (_name, body, contentType) => {
      mocks.access.mockResolvedValueOnce({
        response: new Response(JSON.stringify({ message: "generic" }), { status: 401 }),
      });
      const unauthenticated = new Request(
        `http://localhost/api/member/applications/${applicationId}/recommendations`,
        {
          body,
          headers: { "content-type": contentType, origin: "http://localhost" },
          method: "POST",
        },
      );
      expect((await POST(unauthenticated, context())).status).toBe(401);
      expect(mocks.mutate).not.toHaveBeenCalled();
    },
  );

  it("does not access the body stream before authorization", async () => {
    mocks.access.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ message: "generic" }), { status: 401 }),
    });
    const unauthenticated = request();
    Object.defineProperty(unauthenticated, "body", {
      get: () => {
        throw new Error("body accessed before authorization");
      },
    });
    await expect(POST(unauthenticated, context())).resolves.toMatchObject({ status: 401 });
  });

  it("parses and validates bodies after successful authorization", async () => {
    const malformed = new Request(
      `http://localhost/api/member/applications/${applicationId}/recommendations`,
      {
        body: "{",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        method: "POST",
      },
    );
    expect((await POST(malformed, context())).status).toBe(400);
    expect((await POST(request(valid, "text/plain"), context())).status).toBe(415);
    expect((await POST(request({ ...valid, ownerId: "forged" }), context())).status).toBe(422);
  });

  it("uses the same generic not-found shape for malformed and hidden application IDs", async () => {
    const malformed = await POST(request(), context("not-an-id"));
    expect(malformed.status).toBe(404);
    await expect(malformed.json()).resolves.toEqual({ message: "generic" });

    mocks.mutate.mockResolvedValueOnce({ outcome: "not_found" });
    const hidden = await POST(request(), context());
    expect(hidden.status).toBe(404);
    await expect(hidden.json()).resolves.toEqual({ message: "generic" });
  });
});
