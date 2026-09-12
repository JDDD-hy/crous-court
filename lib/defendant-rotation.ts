export function nextDefendantIndex(current: number, total: number, step = 1) {
  return total > 0 ? (current + step + total) % total : 0;
}

export function firstUnreviewedIndex(dishIds: string[], reviewedDishIds: Readonly<Record<string, unknown>>) {
  const index = dishIds.findIndex((dishId) => reviewedDishIds[dishId] === undefined);
  return index < 0 ? 0 : index;
}
