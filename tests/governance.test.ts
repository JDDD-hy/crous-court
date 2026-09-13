import test from "node:test";
import assert from "node:assert/strict";
import { identificationSchema } from "../lib/ai/dish-identification-schema.ts";
import { normalizeDishName } from "../lib/governance/name-utils.ts";

test("normalizes dish names without erasing the original label", () => {
  assert.equal(normalizeDishName("  Crème   Dessert  "), "crème dessert");
});

test("accepts an unrecognizable meal only when every required field is present", () => {
  const result = identificationSchema.parse({ analysis_status: "unusable_image", is_food_image: false, is_standard_meal: false, staple: null, side_dishes: [], other_visible_items: [], warnings: ["image_too_blurry"], scene_description: "" });
  assert.equal(result.staple, null);
  assert.throws(() => identificationSchema.parse({ analysis_status: "unusable_image", is_food_image: false }));
});

test("rejects incomplete side dish objects and out-of-range confidence", () => {
  const base = { analysis_status: "identified", is_food_image: true, is_standard_meal: false, staple: { name: "粗麦粉", confidence: 0.8, region: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }, other_visible_items: [], warnings: [], scene_description: "餐盘中有粗麦粉和酸奶。" };
  assert.throws(() => identificationSchema.parse({ ...base, side_dishes: [{ name: "酸奶", type: "酸奶", confidence: 0.8 }] }));
  assert.throws(() => identificationSchema.parse({ ...base, side_dishes: [], staple: { name: "粗麦粉", confidence: 2 } }));
});

test("keeps separately grouped salad and bread with cheese as two side dishes", () => {
  const result = identificationSchema.parse({ analysis_status: "identified", is_food_image: true, is_standard_meal: true, staple: { name: "鳕鱼配土豆泥", confidence: 0.8, region: { x: 0.2, y: 0.3, width: 0.6, height: 0.6 } }, side_dishes: [
    { name: "奶油拌蔬菜沙拉", type: "色拉", ingredients: ["蔬菜"], confidence: 0.75, region: { x: 0.05, y: 0.05, width: 0.3, height: 0.3 } },
    { name: "面包配奶酪", type: "其他", ingredients: ["面包", "奶酪"], confidence: 0.78, region: null },
  ], other_visible_items: [], warnings: [], scene_description: "餐盘中有鳕鱼配土豆泥、蔬菜沙拉和面包奶酪。" });
  assert.deepEqual(result.side_dishes.map((dish) => dish.name), ["奶油拌蔬菜沙拉", "面包配奶酪"]);
});

test("rejects an AI region outside the source image", () => {
  assert.throws(() => identificationSchema.parse({ analysis_status: "identified", is_food_image: true, is_standard_meal: false, staple: { name: "粗麦粉", confidence: 0.8, region: { x: 0.8, y: 0.1, width: 0.4, height: 0.5 } }, side_dishes: [], other_visible_items: [], warnings: [], scene_description: "" }));
});
