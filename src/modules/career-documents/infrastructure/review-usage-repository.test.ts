import type { TransactionSql } from "postgres";
import { describe, expect, it } from "vitest";
import { reserveCareerDocumentReviewUsage } from "./review-usage-repository";

describe("career-document review usage repository", () => {
  it("passes owner, request mode and all ceilings to the atomic reservation function", async () => {
    const calls: unknown[][] = [];
    const database = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(values);
      return [{ reserved: true }];
    }) as unknown as TransactionSql;

    await expect(
      reserveCareerDocumentReviewUsage(database, "owner-id", true, {
        hostedAccountMonthly: 400,
        memberDaily: 10,
        memberMonthly: 40,
      }),
    ).resolves.toBe(true);
    expect(calls).toEqual([["owner-id", true, 10, 40, 400]]);
  });

  it("fails closed when the database returns no reservation row", async () => {
    const database = (async () => []) as unknown as TransactionSql;

    await expect(
      reserveCareerDocumentReviewUsage(database, "owner-id", false, {
        hostedAccountMonthly: 400,
        memberDaily: 10,
        memberMonthly: 40,
      }),
    ).resolves.toBe(false);
  });
});
