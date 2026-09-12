import type { Tier } from "./ranking";

export type VoteMotionEvent = {
  id: string;
  dishId: string;
  fromTier: Tier | null;
  toTier: Tier | null;
};

export function getVerdictMotion(fromTier: Tier | null, toTier: Tier | null) {
  const distance = fromTier !== null && toTier !== null ? toTier - fromTier : 0;
  return {
    distance,
    direction: distance < 0 ? "up" : distance > 0 ? "down" : "same",
    shatter: fromTier !== null && toTier !== null && (distance >= 2 || (toTier === 5 && fromTier !== 5)),
  } as const;
}
