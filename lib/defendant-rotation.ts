export function nextDefendantIndex(current: number, total: number, step = 1) {
  return total > 0 ? (current + step + total) % total : 0;
}
