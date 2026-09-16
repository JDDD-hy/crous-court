import { z } from "zod";

const warning = z.enum(["no_staple_visible", "multiple_meals_visible", "more_than_two_sides", "image_too_blurry", "food_partially_occluded", "personal_information_visible"]);
const region = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict()
  .refine((box) => box.x + box.width <= 1 && box.y + box.height <= 1, "region exceeds image bounds");
const food = z.object({ name: z.string().min(1).max(80), confidence: z.number().min(0).max(1), region: region.nullable() }).strict();
const side = food.extend({ type: z.enum(["甜点", "色拉", "水果", "酸奶", "其他"]), ingredients: z.array(z.string().min(1).max(40)).max(8) }).strict();

export const identificationSchema = z.object({
  analysis_status: z.enum(["identified", "partially_identified", "unusable_image"]),
  is_food_image: z.boolean(),
  is_standard_meal: z.boolean(),
  staple: food.nullable(),
  side_dishes: z.array(side).max(8),
  other_visible_items: z.array(z.string().min(1).max(80)).max(8),
  warnings: z.array(warning).max(6),
  scene_description: z.string().max(200),
}).strict();

export type DishIdentification = z.infer<typeof identificationSchema>;
