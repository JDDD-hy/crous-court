import { findDishCandidates } from "@/lib/governance/dish-candidates";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    if (category !== "main" && category !== "side") throw new Error("invalid category");
    const q = (url.searchParams.get("q") ?? "").slice(0, 80);
    if (!q.trim()) return Response.json({ data: [], error: null, requestId });
    return Response.json({ data: await findDishCandidates(q, category), error: null, requestId });
  } catch {
    return Response.json({ data: null, error: "菜品候选暂时不可用", requestId }, { status: 400 });
  }
}
