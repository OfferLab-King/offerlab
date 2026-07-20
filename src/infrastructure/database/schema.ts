import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const appSchema = pgSchema("app");
const authSchema = pgSchema("auth");

const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const appUsers = appSchema.table(
  "user",
  {
    authUserId: uuid("auth_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    email: text("email").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    role: text("role").default("member").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("user_role_check", sql`${table.role} in ('member', 'administrator')`),
    uniqueIndex("user_auth_user_id_unique").on(table.authUserId),
    uniqueIndex("user_email_lower_unique").on(sql`lower(${table.email})`),
    uniqueIndex("user_single_administrator")
      .on(table.role)
      .where(sql`${table.role} = 'administrator'`),
  ],
);

export const auditEvents = appSchema.table(
  "audit_event",
  {
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    entityId: uuid("entity_id"),
    entityType: text("entity_type").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().default({}).notNull(),
  },
  (table) => [index("audit_event_entity_idx").on(table.entityType, table.entityId)],
);

export const invitations = appSchema.table(
  "invitation",
  {
    boundAt: timestamp("bound_at", { mode: "date", withTimezone: true }),
    boundAuthUserId: uuid("bound_auth_user_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    consumedAt: timestamp("consumed_at", { mode: "date", withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => appUsers.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => appUsers.id, {
      onDelete: "restrict",
    }),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    tokenHash: text("token_hash").notNull(),
  },
  (table) => [
    index("invitation_bound_identity_lookup")
      .on(table.boundAuthUserId, table.boundAt)
      .where(sql`${table.boundAuthUserId} is not null`),
    index("invitation_email_lookup").on(table.email, table.createdAt),
    uniqueIndex("invitation_token_hash_unique").on(table.tokenHash),
  ],
);

export const betaEntitlements = appSchema.table(
  "beta_entitlement",
  {
    activatedAt: timestamp("activated_at", { mode: "date", withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    userId: uuid("user_id")
      .primaryKey()
      .references(() => appUsers.id, { onDelete: "restrict" }),
  },
  (table) => [
    check("beta_entitlement_status_check", sql`${table.status} in ('active', 'revoked')`),
  ],
);

export const onboardingProfiles = appSchema.table(
  "onboarding_profile",
  {
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    confidence: text("confidence"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    educationStage: text("education_stage"),
    industries: text("industries").array().default([]).notNull(),
    opportunityTypes: text("opportunity_types").array().default([]).notNull(),
    preparationPriorities: text("preparation_priorities").array().default([]).notNull(),
    supportNeeds: text("support_needs").array().default([]).notNull(),
    targetCompanies: text("target_companies").array().default([]).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    userId: uuid("user_id")
      .primaryKey()
      .references(() => appUsers.id, { onDelete: "restrict" }),
  },
  (table) => [
    check(
      "onboarding_completion_derived_check",
      sql`(${table.completedAt} is not null) = (${table.educationStage} is not null and cardinality(${table.opportunityTypes}) > 0 and cardinality(${table.industries}) > 0 and cardinality(${table.preparationPriorities}) > 0)`,
    ),
  ],
);

export const authRateLimits = appSchema.table(
  "auth_rate_limit",
  {
    action: text("action").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("auth_rate_limit_window_started_at_idx").on(table.windowStartedAt),
    primaryKey({ columns: [table.action, table.keyHash] }),
  ],
);
