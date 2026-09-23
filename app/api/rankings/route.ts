import { localizedJson } from "@/lib/i18n/server";
import { getUserVotes, rankingPage } from "@/lib/ranking-service";
import { getEmailUser } from "@/lib/auth/email-auth";
import { parseRankingPage, rankingPageSize } from "@/lib/ranking-query";
import { getVenueScope } from "@/lib/venue-scope";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const category = new URL(request.url).searchParams.get("category");
    if (category !== null && category !== "main" && category !== "side") {
      return localizedJson({ data: null, error: "category must be main or side", requestId }, { status: 400 });
    }
    const requested = new URL(request.url).searchParams.getAll("venue");
    const scope = requested.length ? await getVenueScope(requested) : null;
    if (scope?.invalid) return localizedJson({ data: null, error: "Unknown venue", requestId }, { status: 400 });
    const url = new URL(request.url);
    const relatedTo = url.searchParams.get("relatedTo");
    if (url.searchParams.getAll("relatedTo").length > 1 || (relatedTo !== null && !/^[a-zA-Z0-9_-]{1,80}$/.test(relatedTo))) {
      return localizedJson({ data: null, error: "Invalid dish group", requestId }, { status: 400 });
    }
    const limit = relatedTo ? 12 : rankingPageSize;
    const result = await rankingPage({ category: category ?? undefined, venueIds: scope?.ids, relatedTo: relatedTo ?? undefined, limit, page: parseRankingPage(url.searchParams.has("page") ? url.searchParams.getAll("page").length === 1 ? url.searchParams.get("page")! : [] : undefined) });
    const user = relatedTo ? await getEmailUser() : null;
    const reviewedDishIds = user ? await getUserVotes(result.dishes.map(dish => dish.id), user.userId) : {};
    return localizedJson({ data: result.dishes, ...(relatedTo ? { reviewedDishIds } : {}), pagination: { page: result.page, pageSize: limit, total: result.total }, error: null, requestId }, relatedTo ? { headers: { "cache-control": "private, no-store" } } : undefined);
  } catch (error) {
    if (error instanceof RangeError) return localizedJson({ data: null, error: "Invalid ranking page", requestId }, { status: 400 });
    return localizedJson({ data: null, error: "ranking data is unavailable", requestId }, { status: 500 });
  }
}
