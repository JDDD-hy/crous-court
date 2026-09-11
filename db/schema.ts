import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  emailDigest: text("email_digest"),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("users_email_digest_unique").on(table.emailDigest)]);

export const emailOtpChallenges = sqliteTable("email_otp_challenges", {
  id: text("id").primaryKey(),
  emailDigest: text("email_digest").notNull(),
  codeDigest: text("code_digest").notNull(),
  ipDigest: text("ip_digest").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: integer("consumed_at"),
  sessionId: text("session_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("email_otp_challenges_email_created_idx").on(table.emailDigest, table.createdAt),
  index("email_otp_challenges_ip_created_idx").on(table.ipDigest, table.createdAt),
  check("email_otp_challenges_attempts_check", sql`${table.attempts} between 0 and 5`),
]);

export const authSessions = sqliteTable("auth_sessions", {
  tokenDigest: text("token_digest").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (table) => [index("auth_sessions_user_idx").on(table.userId)]);

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  nickname: text("nickname").notNull(),
  address: text("address"),
  latitude: integer("latitude"),
  longitude: integer("longitude"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  displayNumber: integer("display_number").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("venues_canonical_name_unique").on(table.canonicalName),
  uniqueIndex("venues_display_number_unique").on(table.displayNumber),
  check("venues_active_check", sql`${table.active} in (0, 1)`),
]);

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  eatenOn: text("eaten_on").notNull(),
  caseNumber: text("case_number").notNull(),
  displayOrder: integer("display_order").notNull(),
  overallNote: text("overall_note"),
  status: text("status", { enum: ["active", "hidden"] }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("meals_venue_date_idx").on(table.venueId, table.eatenOn),
  uniqueIndex("meals_case_number_unique").on(table.caseNumber),
  uniqueIndex("meals_venue_date_order_unique").on(table.venueId, table.eatenOn, table.displayOrder),
  check("meals_status_check", sql`${table.status} in ('active', 'hidden')`),
]);

export const dailyCaseCounters = sqliteTable("daily_case_counters", {
  eatenOn: text("eaten_on").notNull(),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
  nextSequence: integer("next_sequence").notNull(),
}, (table) => [
  primaryKey({ columns: [table.eatenOn, table.venueId] }),
  check("daily_case_counters_sequence_check", sql`${table.nextSequence} > 0`),
]);

export const dishes = sqliteTable("dishes", {
  id: text("id").primaryKey(),
  canonicalNameFr: text("canonical_name_fr"),
  canonicalNameZh: text("canonical_name_zh"),
  originalDescription: text("original_description").notNull().default(""),
  category: text("category", { enum: ["main", "side"] }).notNull(),
  namingStatus: text("naming_status", { enum: ["unknown", "suggested", "community", "verified"] }).notNull().default("unknown"),
  createdAt: createdAt(),
}, (table) => [
  index("dishes_category_idx").on(table.category),
  check("dishes_category_check", sql`${table.category} in ('main', 'side')`),
  check("dishes_naming_status_check", sql`${table.namingStatus} in ('unknown', 'suggested', 'community', 'verified')`),
]);

export const servings = sqliteTable("servings", {
  id: text("id").primaryKey(),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
  servedOn: text("served_on").notNull(),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  initialTier: integer("initial_tier").notNull(),
  status: text("status", { enum: ["active", "hidden"] }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("servings_dish_venue_date_unique").on(table.dishId, table.venueId, table.servedOn),
  index("servings_venue_date_idx").on(table.venueId, table.servedOn),
  check("servings_initial_tier_check", sql`${table.initialTier} between 1 and 5`),
  check("servings_status_check", sql`${table.status} in ('active', 'hidden')`),
]);

export const mealItems = sqliteTable("meal_items", {
  mealId: text("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
  servingId: text("serving_id").notNull().references(() => servings.id, { onDelete: "restrict" }),
  slot: text("slot", { enum: ["main", "side_1", "side_2"] }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.mealId, table.slot] }),
  uniqueIndex("meal_items_meal_serving_unique").on(table.mealId, table.servingId),
  check("meal_items_slot_check", sql`${table.slot} in ('main', 'side_1', 'side_2')`),
]);

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  mealId: text("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  canonicalKey: text("canonical_key").notNull(),
  thumbnailKey: text("thumbnail_key").notNull(),
  mediaType: text("media_type", { enum: ["image/jpeg", "image/png"] }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("photos_canonical_key_unique").on(table.canonicalKey),
  uniqueIndex("photos_thumbnail_key_unique").on(table.thumbnailKey),
  check("photos_media_type_check", sql`${table.mediaType} in ('image/jpeg', 'image/png')`),
  check("photos_dimensions_check", sql`${table.width} > 0 and ${table.height} > 0`),
  check("photos_byte_size_check", sql`${table.byteSize} > 0`),
]);

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  targetTier: integer("target_tier").notNull(),
  createdAt: createdAt(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("votes_dish_user_unique").on(table.dishId, table.userId),
  index("votes_dish_tier_idx").on(table.dishId, table.targetTier),
  check("votes_target_tier_check", sql`${table.targetTier} between 1 and 5`),
]);
