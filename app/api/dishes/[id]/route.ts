import { localizedJson } from "@/lib/i18n/server";
import { getDishDetail } from "@/lib/ranking-service";
import { parseRankingPage } from "@/lib/ranking-query";
import { reportServerError } from "@/lib/server-error";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const query = new URL(request.url).searchParams;
    const page = (key: string) => parseRankingPage(query.has(key) ? query.getAll(key).length === 1 ? query.get(key)! : [] : undefined);
    const dish = await getDishDetail((await params).id, page("evidencePage"), page("historyPage"));
    if (!dish) return localizedJson({ data: null, error: "dish not found", requestId }, { status: 404 });
    return localizedJson({ data: dish, error: null, requestId });
  } catch (error) {
    if (error instanceof RangeError) return localizedJson({ data: null, error: "Invalid page", requestId }, { status: 400 });
    reportServerError("dish_detail", requestId, error);
    return localizedJson({ data: null, error: "dish data is unavailable", requestId }, { status: 500 });
  }
}
