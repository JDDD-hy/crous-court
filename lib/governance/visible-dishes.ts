// Shared by AI scan, saved suggestions and acceptance; photos are optional, real sightings are not.
export const visibleDishIds = `SELECT s.dish_id FROM servings s
  JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id
  WHERE s.status='active' AND m.status='active'`;
