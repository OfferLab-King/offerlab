import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./environment";

const validEnvironment: NodeJS.ProcessEnv = {
  APP_ENV: "test",
  LOG_LEVEL: "silent",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NODE_ENV: "test",
};

describe("parseServerEnvironment", () => {
  it("accepts a valid test environment", () => {
    expect(parseServerEnvironment(validEnvironment).APP_ENV).toBe("test");
  });

  it("permits authentication bypass only for loopback local development", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        NODE_ENV: "development",
      }),
    ).not.toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_ENABLED");
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        NEXT_PUBLIC_APP_URL: "https://offerlab.example",
        NODE_ENV: "development",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_ENABLED");
  });

  it("keeps the administrator bypass role inside the local loopback bypass boundary", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_ROLE: "administrator",
        NODE_ENV: "development",
      }),
    ).not.toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ROLE: "administrator",
        NODE_ENV: "development",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_ROLE");
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_ROLE: "administrator",
        NODE_ENV: "production",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_ROLE");
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_ROLE: "administrator",
        NEXT_PUBLIC_APP_URL: "https://offerlab.example",
        NODE_ENV: "development",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_ROLE");
  });

  it("permits a UUID-selected bypass user only for loopback local development", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_USER_ID: "20000000-0000-4000-8000-000000000001",
        NODE_ENV: "development",
      }),
    ).not.toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_USER_ID: "not-a-uuid",
        NODE_ENV: "development",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_USER_ID");
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "local",
        LOCAL_AUTH_BYPASS_USER_ID: "20000000-0000-4000-8000-000000000001",
        NODE_ENV: "development",
      }),
    ).toThrow("LOCAL_AUTH_BYPASS_USER_ID");
  });

  it("requires runtime and identity credentials but not migration credentials in production", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("requires complete DeepSeek configuration and a separate production data approval", () => {
    const deepSeek = {
      ...validEnvironment,
      ANSWER_COACH_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "test-api-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-v4-flash",
    };
    expect(() => parseServerEnvironment(deepSeek)).not.toThrow();
    expect(() =>
      parseServerEnvironment({
        ...deepSeek,
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        NODE_ENV: "production",
      }),
    ).toThrow("ANSWER_COACH_MODEL_DATA_APPROVED");
    expect(() =>
      parseServerEnvironment({
        ...deepSeek,
        ANSWER_COACH_MODEL_DATA_APPROVED: "true",
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        JOB_CRAWLER_MODEL_DATA_APPROVED: "true",
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("keeps local career review bootable when hosted document AI is switched off", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        CAREER_DOCUMENT_AI_ENABLED: "false",
        CAREER_DOCUMENT_PROVIDER: "deepseek",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        JOB_CRAWLER_MODEL_DATA_APPROVED: "true",
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("requires a separate crawler login when the production catalog is enabled", () => {
    const environment: NodeJS.ProcessEnv = {
      ...validEnvironment,
      APP_ENV: "production",
      AUTH_RATE_LIMIT_SECRET: "production-test-secret",
      DATABASE_URL: "postgresql://runtime.invalid/database",
      IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
      JOB_CATALOG_ENABLED: "true",
      NODE_ENV: "production",
    };
    expect(() => parseServerEnvironment(environment)).toThrow("JOB_CRAWLER_DATABASE_URL");
    expect(() =>
      parseServerEnvironment({
        ...environment,
        JOB_CRAWLER_DATABASE_URL: "postgresql://crawler.invalid/database",
      }),
    ).not.toThrow();
  });

  it("rejects plaintext hosted document transport in production", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        CAREER_DOCUMENT_MODEL_DATA_APPROVED: "true",
        CAREER_DOCUMENT_PROVIDER: "deepseek",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        DEEPSEEK_API_KEY: "test-api-key",
        DEEPSEEK_BASE_URL: "http://api.deepseek.example",
        DEEPSEEK_MODEL: "deepseek-v4-flash",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        NODE_ENV: "production",
      }),
    ).toThrow("DEEPSEEK_BASE_URL");
  });

  it("accepts usage ceilings through 100000 and rejects larger values", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT: "100000",
        JSEARCH_ACCOUNT_MONTHLY_LIMIT: "100000",
      }),
    ).not.toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT: "100001",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        JSEARCH_ACCOUNT_MONTHLY_LIMIT: "999999",
      }),
    ).toThrow();
  });
});
