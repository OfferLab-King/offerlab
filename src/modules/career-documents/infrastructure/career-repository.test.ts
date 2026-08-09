import type { TransactionSql } from "postgres";
import { describe, expect, it, vi } from "vitest";

import {
  findCareerDocumentWorkspaceDocument,
  listCareerDocumentVersionSummaries,
} from "./career-repository";

function databaseWith(rows: readonly unknown[]) {
  const unsafe = vi.fn().mockResolvedValue(rows);
  return { database: { unsafe } as unknown as TransactionSql, unsafe };
}

describe("career document workspace repository reads", () => {
  it("lists owner-scoped dropdown metadata without selecting document or job-description text", async () => {
    const createdAt = new Date("2026-08-07T12:00:00Z");
    const { database, unsafe } = databaseWith([
      {
        created_at: createdAt,
        id: "version-id",
        label: "Graduate developer",
        revision: 3,
      },
    ]);

    await expect(
      listCareerDocumentVersionSummaries(database, "owner-id", "document-id"),
    ).resolves.toEqual([
      {
        createdAt,
        id: "version-id",
        label: "Graduate developer",
        revision: 3,
      },
    ]);

    const [query, parameters] = unsafe.mock.calls[0] as [string, string[]];
    expect(query).toContain("owner_user_id=$1::uuid and document_id=$2::uuid");
    expect(query).not.toMatch(/content_text|job_description/u);
    expect(parameters).toEqual(["owner-id", "document-id"]);
  });

  it("loads only owner-scoped document metadata for the workspace shell", async () => {
    const { database, unsafe } = databaseWith([
      {
        archived_at: null,
        id: "document-id",
        kind: "cv",
        title: "Developer CV",
      },
    ]);

    await expect(
      findCareerDocumentWorkspaceDocument(database, "owner-id", "document-id"),
    ).resolves.toEqual({
      archivedAt: null,
      id: "document-id",
      kind: "cv",
      title: "Developer CV",
    });

    const [query, parameters] = unsafe.mock.calls[0] as [string, string[]];
    expect(query).toContain("select id,kind,title,archived_at");
    expect(query).toContain("owner_user_id=$1::uuid and id=$2::uuid");
    expect(query).not.toMatch(/content_text|job_description/u);
    expect(parameters).toEqual(["owner-id", "document-id"]);
  });
});
