import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
});

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  nickname: text("nickname").notNull(),
  address: text("address"),
  latitude: integer("latitude"),
  longitude: integer("longitude"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("venues_canonical_name_unique").on(table.canonicalName),
  check("venues_active_check", sql`${table.active} in (0, 1)`),
]);

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  eatenOn: text("eaten_on").notNull(),
  overallNote: text("overall_note"),
  status: text("status", { enum: ["active", "hidden"] }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("meals_venue_date_idx").on(table.venueId, table.eatenOn),
  check("meals_status_check", sql`${table.status} in ('active', 'hidden')`),
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
