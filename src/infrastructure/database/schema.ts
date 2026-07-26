import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
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

export const applications = appSchema.table(
  "application",
  {
    appliedDate: date("applied_date"),
    applicationDeadline: date("application_deadline"),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    companyName: text("company_name").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    currentStage: text("current_stage").notNull(),
    industry: text("industry"),
    id: uuid("id").defaultRandom().primaryKey(),
    location: text("location"),
    nextStageDeadline: date("next_stage_deadline"),
    notes: text("notes"),
    opportunityType: text("opportunity_type").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    roleTitle: text("role_title").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("application_version_check", sql`${table.version} > 0`),
    index("application_owner_active_deadline_idx")
      .on(table.ownerUserId, table.nextStageDeadline, table.applicationDeadline)
      .where(sql`${table.archivedAt} is null`),
    index("application_owner_archived_idx")
      .on(table.ownerUserId, table.archivedAt)
      .where(sql`${table.archivedAt} is not null`),
    unique("application_owner_id_unique").on(table.ownerUserId, table.id),
  ],
);

export const recommendationStates = appSchema.table(
  "recommendation_state",
  {
    applicationId: uuid("application_id").notNull(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at", { mode: "date", withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    recommendationKey: text("recommendation_key").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    state: text("state").default("pending").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ownerUserId, table.applicationId],
      foreignColumns: [applications.ownerUserId, applications.id],
      name: "recommendation_state_application_owner_fk",
    }).onDelete("restrict"),
    check(
      "recommendation_state_key_check",
      sql`${table.recommendationKey} ~ '^[a-z][a-z0-9_]{0,79}$'`,
    ),
    check("recommendation_state_rule_version_check", sql`${table.ruleVersion} > 0`),
    check(
      "recommendation_state_state_check",
      sql`${table.state} in ('pending', 'completed', 'dismissed')`,
    ),
    check("recommendation_state_version_check", sql`${table.version} > 0`),
    check(
      "recommendation_state_timestamps_check",
      sql`${table.updatedAt} >= ${table.createdAt} and (${table.completedAt} is null or ${table.completedAt} between ${table.createdAt} and ${table.updatedAt}) and (${table.dismissedAt} is null or ${table.dismissedAt} between ${table.createdAt} and ${table.updatedAt})`,
    ),
    check(
      "recommendation_state_transition_timestamps_check",
      sql`(${table.state} = 'pending' and ${table.completedAt} is null and ${table.dismissedAt} is null) or (${table.state} = 'completed' and ${table.completedAt} is not null and ${table.dismissedAt} is null) or (${table.state} = 'dismissed' and ${table.completedAt} is null and ${table.dismissedAt} is not null)`,
    ),
    unique("recommendation_state_identity_unique").on(
      table.ownerUserId,
      table.applicationId,
      table.recommendationKey,
      table.ruleVersion,
    ),
    index("recommendation_state_owner_application_state_idx").on(
      table.ownerUserId,
      table.applicationId,
      table.state,
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

export const learningPaths = appSchema.table("learning_path", {
  archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  firstPublishedAt: timestamp("first_published_at", { mode: "date", withTimezone: true }),
  id: uuid("id").defaultRandom().primaryKey(),
  introduction: text("introduction").default("").notNull(),
  pathKey: text("path_key").notNull().unique(),
  primaryCategoryId: uuid("primary_category_id"),
  publicationState: text("publication_state").default("draft").notNull(),
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
  shortDescription: text("short_description").default("").notNull(),
  slug: text("slug").notNull().unique(),
  structureFingerprint: text("structure_fingerprint").default("").notNull(),
  title: text("title").default("").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
});

export const learningPathSections = appSchema.table("learning_path_section", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  learningPathId: uuid("learning_path_id")
    .notNull()
    .references(() => learningPaths.id, { onDelete: "cascade" }),
  heading: text("heading").notNull(),
  position: integer("position").notNull(),
  shortDescription: text("short_description").default("").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const learningPathItems = appSchema.table("learning_path_item", {
  contextNote: text("context_note").default("").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  learningPathId: uuid("learning_path_id")
    .notNull()
    .references(() => learningPaths.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  preparationResourceId: uuid("preparation_resource_id").notNull(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => learningPathSections.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const memberLearningPathStates = appSchema.table("member_learning_path_state", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  learningPathId: uuid("learning_path_id")
    .notNull()
    .references(() => learningPaths.id, { onDelete: "restrict" }),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
  stoppedAt: timestamp("stopped_at", { mode: "date", withTimezone: true }),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const competencies = appSchema.table("competency", {
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  position: integer("position").notNull().unique(),
  stableKey: text("stable_key").notNull().unique(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const memberStories = appSchema.table("member_story", {
  actions: text("actions").default("").notNull(),
  archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  experienceType: text("experience_type").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  readyAt: timestamp("ready_at", { mode: "date", withTimezone: true }),
  reasoning: text("reasoning").default("").notNull(),
  reflection: text("reflection").default("").notNull(),
  relationRevision: integer("relation_revision").default(0).notNull(),
  result: text("result").default("").notNull(),
  situation: text("situation").default("").notNull(),
  summary: text("summary"),
  task: text("task").default("").notNull(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
});

export const interviewQuestions = appSchema.table("interview_question", {
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  guidance: text("guidance").default("").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  position: integer("position").notNull().unique(),
  prompt: text("prompt").notNull(),
  questionFamily: text("question_family").notNull(),
  stableKey: text("stable_key").notNull().unique(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const memberAnswers = appSchema.table("member_answer", {
  applicationId: uuid("application_id"),
  archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  customQuestion: text("custom_question"),
  draftAnswer: text("draft_answer").default("").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  keyPoints: text("key_points").default("").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  questionFamily: text("question_family").notNull(),
  questionId: uuid("question_id").references(() => interviewQuestions.id, { onDelete: "restrict" }),
  readyAt: timestamp("ready_at", { mode: "date", withTimezone: true }),
  recruitmentStage: text("recruitment_stage"),
  relationRevision: integer("relation_revision").default(0).notNull(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
});

export const answerCoachReviews = appSchema.table(
  "answer_coach_review",
  {
    answerId: uuid("answer_id").notNull(),
    answerSnapshot: text("answer_snapshot").notNull(),
    answerVersion: integer("answer_version").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    followUpQuestions: jsonb("follow_up_questions").$type<string[]>().default([]).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    promptId: text("prompt_id").default("answer_coach").notNull(),
    promptVersion: integer("prompt_version").default(1).notNull(),
    providerId: text("provider_id").notNull(),
    providerMode: text("provider_mode").notNull(),
    strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
    summary: text("summary").notNull(),
    unsupportedClaims: jsonb("unsupported_claims").$type<string[]>().default([]).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ownerUserId, table.answerId],
      foreignColumns: [memberAnswers.ownerUserId, memberAnswers.id],
      name: "answer_coach_review_answer_fk",
    }).onDelete("restrict"),
    unique("answer_coach_review_owner_id_unique").on(table.ownerUserId, table.id),
    index("answer_coach_review_owner_answer_created_idx").on(
      table.ownerUserId,
      table.answerId,
      table.createdAt,
    ),
  ],
);

export const answerCoachComments = appSchema.table(
  "answer_coach_comment",
  {
    anchorEnd: integer("anchor_end").notNull(),
    anchorQuote: text("anchor_quote").notNull(),
    anchorStart: integer("anchor_start").notNull(),
    category: text("category").notNull(),
    coachingQuestion: text("coaching_question").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    observation: text("observation").notNull(),
    optionalRevision: text("optional_revision"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    reviewId: uuid("review_id").notNull(),
    state: text("state").default("open").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ownerUserId, table.reviewId],
      foreignColumns: [answerCoachReviews.ownerUserId, answerCoachReviews.id],
      name: "answer_coach_comment_review_fk",
    }).onDelete("cascade"),
    unique("answer_coach_comment_review_position_unique").on(table.reviewId, table.position),
  ],
);

export const recruitmentIntelligenceReports = appSchema.table(
  "recruitment_intelligence_report",
  {
    approximateDate: date("approximate_date").notNull(),
    assessedSkills: text("assessed_skills").array().default([]).notNull(),
    companyName: text("company_name").notNull(),
    confidentialityConfirmedAt: timestamp("confidentiality_confirmed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    formatSummary: text("format_summary").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    industry: text("industry"),
    location: text("location"),
    moderatedAt: timestamp("moderated_at", { mode: "date", withTimezone: true }),
    moderatedByUserId: uuid("moderated_by_user_id").references(() => appUsers.id, {
      onDelete: "restrict",
    }),
    moderationConfidence: text("moderation_confidence"),
    moderationState: text("moderation_state").default("pending").notNull(),
    opportunityType: text("opportunity_type"),
    outcome: text("outcome"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    recruitmentCycle: text("recruitment_cycle").notNull(),
    recruitmentStage: text("recruitment_stage").notNull(),
    preparationAdvice: text("preparation_advice").notNull(),
    reflection: text("reflection").notNull(),
    roleTitle: text("role_title").notNull(),
    slug: text("slug").notNull().unique(),
    sourceKind: text("source_kind").notNull(),
    themes: text("themes").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [unique("recruitment_intelligence_owner_id_unique").on(table.ownerUserId, table.id)],
);

export const serviceOfferings = appSchema.table("service_offering", {
  availability: text("availability").default("interest").notNull(),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  deliveryMode: text("delivery_mode").notNull(),
  endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
  id: uuid("id").defaultRandom().primaryKey(),
  offeringType: text("offering_type").notNull(),
  position: integer("position").notNull().unique(),
  stableKey: text("stable_key").notNull().unique(),
  startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
  summary: text("summary").notNull(),
  title: text("title").notNull(),
  turnaroundDays: integer("turnaround_days"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  version: integer("version").default(1).notNull(),
});

export const serviceRequests = appSchema.table(
  "service_request",
  {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => serviceOfferings.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    status: text("status").default("requested").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [unique("service_request_identity_unique").on(table.ownerUserId, table.offeringId)],
);
