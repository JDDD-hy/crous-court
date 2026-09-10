import type { Tier, VerdictStatus } from "./ranking";

export type DishCategory = "main" | "side";

export type DishSummary = {
  id: string;
  name: string;
  zh: string;
  venue: string;
  date: string;
  image: string;
  tier: Tier | null;
  initialTier: Tier | null;
  votes: number;
  category: DishCategory;
  status: VerdictStatus;
};

export type DishDetail = DishSummary & {
  distribution: [number, number, number, number, number];
  servings: Array<{ id: string; date: string; venue: string; initialTier: Tier }>;
};
