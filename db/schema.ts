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
  canonicalNameEn: text("canonical_name_en"),
  machineNameZh: text("machine_name_zh"),
  machineNameEn: text("machine_name_en"),
  machineNameEnSource: text("machine_name_en_source"),
  machineNameSource: text("machine_name_source"),
  canonicalNameZh: text("canonical_name_zh"),
  originalDescription: text("original_description").notNull().default(""),
  category: text("category", { enum: ["main", "side"] }).notNull(),
  namingStatus: text("naming_status", { enum: ["unknown", "suggested", "community", "verified"] }).notNull().default("unknown"),
  mergedIntoDishId: text("merged_into_dish_id"),
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
  originalDescription: text("original_description").notNull().default(""),
  initialTier: integer("initial_tier").notNull(),
  status: text("status", { enum: ["active", "hidden"] }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("servings_venue_date_idx").on(table.venueId, table.servedOn),
  check("servings_initial_tier_check", sql`${table.initialTier} between 1 and 5`),
  check("servings_status_check", sql`${table.status} in ('active', 'hidden')`),
]);

export const mealItems = sqliteTable("meal_items", {
  mealId: text("meal_id").notNull().references(() => meals.id, { onDelete: "cascade" }),
  servingId: text("serving_id").notNull().references(() => servings.id, { onDelete: "restrict" }),
  slot: text("slot", { enum: ["main", "side_1", "side_2", "side_3", "side_4", "side_5", "side_6", "side_7", "side_8"] }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.mealId, table.slot] }),
  uniqueIndex("meal_items_meal_serving_unique").on(table.mealId, table.servingId),
  check("meal_items_slot_check", sql`${table.slot} in ('main', 'side_1', 'side_2', 'side_3', 'side_4', 'side_5', 'side_6', 'side_7', 'side_8')`),
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
  contentSha256: text("content_sha256"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("photos_canonical_key_unique").on(table.canonicalKey),
  uniqueIndex("photos_thumbnail_key_unique").on(table.thumbnailKey),
  uniqueIndex("photos_creator_sha256_unique").on(table.creatorId, table.contentSha256),
  check("photos_media_type_check", sql`${table.mediaType} in ('image/jpeg', 'image/png')`),
  check("photos_dimensions_check", sql`${table.width} > 0 and ${table.height} > 0`),
  check("photos_byte_size_check", sql`${table.byteSize} > 0`),
]);

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  targetTier: integer("target_tier").notNull(),
  sourceServingId: text("source_serving_id").references(() => servings.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("votes_dish_user_unique").on(table.dishId, table.userId),
  index("votes_dish_tier_idx").on(table.dishId, table.targetTier),
  check("votes_target_tier_check", sql`${table.targetTier} between 1 and 5`),
]);

export const voteRateLimits = sqliteTable("vote_rate_limits", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  windowStartedAt: integer("window_started_at").notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [check("vote_rate_limits_attempts_check", sql`${table.attempts} between 1 and 30`)]);

export const uploadRateLimits = sqliteTable("upload_rate_limits", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  windowStartedAt: integer("window_started_at").notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [check("upload_rate_limits_attempts_check", sql`${table.attempts} between 1 and 5`)]);

export const dishAliases = sqliteTable("dish_aliases", {
  id: text("id").primaryKey(),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  language: text("language", { enum: ["fr", "en", "zh", "other"] }).notNull().default("other"),
  source: text("source", { enum: ["user", "community", "admin"] }).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("dish_aliases_dish_normalized_unique").on(table.dishId, table.normalizedName),
  index("dish_aliases_normalized_idx").on(table.normalizedName),
]);

export const nameSuggestions = sqliteTable("name_suggestions", {
  id: text("id").primaryKey(),
  dishId: text("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  proposerId: text("proposer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  evidenceType: text("evidence_type", { enum: ["menu_photo", "ate_today", "visual_guess", "ai_guess"] }).notNull(),
  evidenceNote: text("evidence_note"),
  status: text("status", { enum: ["pending", "community", "verified", "rejected"] }).notNull().default("pending"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("name_suggestions_dish_proposer_name_unique").on(table.dishId, table.proposerId, table.normalizedName),
  index("name_suggestions_dish_status_idx").on(table.dishId, table.status),
]);

export const nameEndorsements = sqliteTable("name_endorsements", {
  suggestionId: text("suggestion_id").notNull().references(() => nameSuggestions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.suggestionId, table.userId] })]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  dishId: text("dish_id").references(() => dishes.id, { onDelete: "cascade" }),
  mealId: text("meal_id").references(() => meals.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["privacy", "not_food", "abuse", "wrong_dish", "other"] }).notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
  createdAt: createdAt(),
  resolvedAt: text("resolved_at"),
}, (table) => [
  index("reports_status_created_idx").on(table.status, table.createdAt),
  check("reports_target_check", sql`(${table.dishId} is not null) <> (${table.mealId} is not null)`),
]);

export const moderationActions = sqliteTable("moderation_actions", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action", { enum: ["hide_meal", "resolve_report", "dismiss_report", "verify_name", "merge_dish", "split_serving", "repair_split_vote"] }).notNull(),
  targetType: text("target_type", { enum: ["meal", "report", "suggestion", "dish", "serving"] }).notNull(),
  targetId: text("target_id").notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: createdAt(),
}, (table) => [index("moderation_actions_target_idx").on(table.targetType, table.targetId)]);

export const aiIdentifications = sqliteTable("ai_identifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  imageSha256: text("image_sha256").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("ai_identifications_user_image_model_unique").on(table.userId, table.imageSha256, table.model, table.promptVersion),
  index("ai_identifications_user_created_idx").on(table.userId, table.createdAt),
]);

export const aiRateLimits = sqliteTable("ai_rate_limits", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.day] }),
  check("ai_rate_limits_attempts_check", sql`${table.attempts} between 1 and 3`),
]);

export const governanceRateLimits = sqliteTable("governance_rate_limits", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["suggest_name", "endorse_name", "report", "merge_review"] }).notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.action] }),
  check("governance_rate_limits_attempts_check", sql`${table.attempts} between 1 and 30`),
]);

export const aiMergeSuggestions = sqliteTable("ai_merge_suggestions", {
  id: text("id").primaryKey(),
  pairKey: text("pair_key").notNull(),
  sourceId: text("source_id").notNull().references(() => dishes.id),
  targetId: text("target_id").notNull().references(() => dishes.id),
  reason: text("reason").notNull(),
  uncertainty: text("uncertainty").notNull(),
  model: text("model").notNull(),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("ai_merge_pair_unique").on(table.pairKey),
  check("ai_merge_distinct", sql`${table.sourceId} <> ${table.targetId}`),
  check("ai_merge_status", sql`${table.status} in ('pending','accepted','rejected')`),
]);
