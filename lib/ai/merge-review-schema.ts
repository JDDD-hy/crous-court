import { z } from "zod";

export const mergeReviewSchema = z.object({ pairs: z.array(z.object({
  sourceId: z.string().min(1).max(100), targetId: z.string().min(1).max(100),
  reason: z.string().trim().min(1).max(500), uncertainty: z.string().trim().min(1).max(500),
}).strict()).max(20) }).strict();

export function validateMergePairs(value: unknown, dishes: Array<{ id: string; category: string }>) {
  const parsed = mergeReviewSchema.parse(value);
  const seen = new Set<string>();
  return parsed.pairs.filter((pair) => {
    const source = dishes.find((dish) => dish.id === pair.sourceId);
    const target = dishes.find((dish) => dish.id === pair.targetId);
    const key = [pair.sourceId, pair.targetId].sort().join(":");
    if (!source || !target || source.id === target.id || source.category !== target.category) throw new Error("AI 返回无效菜品配对");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type MergeSuggestion = {
  id: string; source_id: string; target_id: string; reason: string; uncertainty: string;
  source_name: string; target_name: string; source_photo: string | null; target_photo: string | null;
};
