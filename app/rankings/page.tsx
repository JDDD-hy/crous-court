import { getLocale, getT } from "@/lib/i18n/server";
import { RankingsView } from "@/components/crous/RankingsView";
import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, rankingPage } from "@/lib/ranking-service";
import { getVenueScope } from "@/lib/venue-scope";
import { parseRankingPage, rankingPageSize } from "@/lib/ranking-query";
import { VenueRequiredNotice, VenueScopeControl } from "@/components/crous/VenueScopeControl";
import { ResultPages } from "@/components/crous/ResultPages";

export const dynamic = "force-dynamic";
export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ venue?: string | string[]; page?: string | string[]; category?: string }> }) {
  const params = await searchParams;
  const t = await getT();
  const scope = await getVenueScope(params.venue, true);
  const category = params.category === "side" ? "side" : "main";
  let page = 1; try { page = parseRankingPage(params.page); } catch { /* Invalid browser links return the first page. */ }
  const [result, user] = await Promise.all([rankingPage({ category, venueIds: scope.ids, page, grouped: true }), getEmailUser()]);
  const reviewedDishIds = user ? await getUserVotes(result.dishes.map(dish=>dish.id),user.userId) : {};
  const query = new URLSearchParams(scope.query); query.set("category",category);
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader authenticated={Boolean(user)} venueQuery={scope.query} scopeControl={<VenueScopeControl options={scope.options} selectedIds={scope.ids} invalid={scope.invalid} pending={scope.pending} />} /><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><p className="font-mono text-sm font-bold text-verdict">{t("长期判决")}</p><h1 className="mt-2 text-4xl font-black">{t("从夯到拉排行榜")}</h1>{scope.pending || scope.invalid || scope.ids?.length === 0 ? <VenueRequiredNotice /> : <><RankingsView dishes={result.dishes} category={category} venueQuery={scope.query} offset={(result.page-1)*rankingPageSize} authenticated={Boolean(user)} reviewedDishIds={reviewedDishIds} /><ResultPages path="/rankings" query={query.toString()} page={result.page} total={result.total} size={rankingPageSize} en={await getLocale()==="en"} /></>}</main></div>;
}
