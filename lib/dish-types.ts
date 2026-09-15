import type { Tier, TierHistoryEntry, VerdictStatus } from "./ranking";

export type DishCategory = "main" | "side";
export type DishNamingStatus = "unknown" | "suggested" | "community" | "verified";

export type DishSummary = {
  id: string;
  name: string;
  zh: string;
  canonicalNameFr?: string | null;
  canonicalNameEn?: string | null;
  canonicalNameZh?: string | null;
  machineNameZh?: string | null;
  machineNameEn?: string | null;
  originalDescription?: string;
  venue: string;
  date: string;
  image: string;
  tier: Tier | null;
  initialTier: Tier | null;
  votes: number;
  distribution: [number, number, number, number, number];
  category: DishCategory;
  namingStatus?: DishNamingStatus;
  status: VerdictStatus;
};

export type DishDetail = DishSummary & {
  servings: Array<{ id: string; mealId: string; date: string; venue: string; originalDescription: string; initialTier: Tier; image: string | null }>;
  tierHistory: TierHistoryEntry[];
};
