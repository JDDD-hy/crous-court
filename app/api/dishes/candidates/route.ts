import { localizedJson } from "@/lib/i18n/server";
import { findDishCandidates } from "@/lib/governance/dish-candidates";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    if (category !== "main" && category !== "side") return localizedJson({ data: null, error: "category must be main or side", requestId }, { status: 400 });
    const q = (url.searchParams.get("q") ?? "").slice(0, 80);
    if (!q.trim()) return localizedJson({ data: [], error: null, requestId });
    return localizedJson({ data: await findDishCandidates(q, category), error: null, requestId });
  } catch {
    return localizedJson({ data: null, error: "菜品候选暂时不可用", requestId }, { status: 500 });
  }
}
