import { listNameSuggestions } from "@/lib/governance/naming-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const dishId = new URL(request.url).searchParams.get("dishId");
    if (!dishId) return Response.json({ data: null, error: "菜品无效", requestId }, { status: 400 });
    return Response.json({ data: await listNameSuggestions(dishId), error: null, requestId });
  } catch { return Response.json({ data: null, error: "名称候选暂时不可用", requestId }, { status: 500 }); }
}
