import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  archive: vi.fn(),
  edit: vi.fn(),
}));

vi.mock("../../src/app/api/member/applications/access", () => ({
  applicationApiOwner: mocks.access,
  genericApplicationError: { message: "generic" },
}));
vi.mock("../../src/modules/identity-access/application/request-security", () => ({
  hasSameOrigin: () => true,
}));
vi.mock("../../src/modules/applications/application/applications", () => ({
  archiveApplication: mocks.archive,
  editApplication: mocks.edit,
  readApplication: vi.fn(),
}));

import { POST } from "../../src/app/api/member/applications/[applicationId]/archive/route";
import { PUT } from "../../src/app/api/member/applications/[applicationId]/route";

const applicationId = "10000000-0000-4000-8000-000000000001";
const privateCurrent = {
  applicationDeadline: "PRIVATE_APPLICATION_DEADLINE",
  appliedDate: "PRIVATE_APPLIED_DATE",
  company: "PRIVATE_COMPANY",
  id: applicationId,
  industry: "PRIVATE_INDUSTRY",
  location: "PRIVATE_LOCATION",
  nextStageDeadline: "PRIVATE_NEXT_STAGE_DEADLINE",
  notes: "PRIVATE_NOTES",
  opportunityType: "PRIVATE_OPPORTUNITY",
  role: "PRIVATE_ROLE",
  stage: "PRIVATE_STAGE",
  version: 42,
};

function request(body: object): Request {
  return new Request(`http://localhost/api/member/applications/${applicationId}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

describe("application conflict route privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ ownerId: "owner" });
  });

  it.each([
    ["update", PUT, mocks.edit, { version: 1 }],
    ["archive", POST, mocks.archive, { archive: true, version: 1 }],
    ["restore", POST, mocks.archive, { archive: false, version: 1 }],
  ] as const)("returns an allow-listed %s conflict", async (_name, handler, mutation, body) => {
    mutation.mockResolvedValue({ current: privateCurrent, ok: true, outcome: "conflict" });
    const response = await handler(request(body), { params: Promise.resolve({ applicationId }) });
    const text = await response.text();

    expect(response.status).toBe(409);
    expect(JSON.parse(text)).toEqual({ ok: true, outcome: "conflict" });
    expect(Object.keys(JSON.parse(text))).toEqual(["ok", "outcome"]);
    for (const [field, value] of Object.entries(privateCurrent)) {
      expect(text).not.toContain(field);
      expect(text).not.toContain(String(value));
    }
  });
});
