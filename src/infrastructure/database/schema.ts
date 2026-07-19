import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgSchema,
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
