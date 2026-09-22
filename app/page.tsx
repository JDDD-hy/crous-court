import { HomePrototype } from "@/components/crous/HomePrototype";
import { ResultPages } from "@/components/crous/ResultPages";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, rankingPage } from "@/lib/ranking-service";
import { todayAndYesterdayInParis } from "@/lib/calendar";
import { getLocale } from "@/lib/i18n/server";
import { getVenueScope } from "@/lib/venue-scope";
import { parseRankingPage, rankingPageSize } from "@/lib/ranking-query";
import { VenueScopeControl } from "@/components/crous/VenueScopeControl";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ venue?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const scope = await getVenueScope(params.venue,true);
  let page = 1; try { page = parseRankingPage(params.page); } catch { /* Invalid browser links return the first page. */ }
  const [recent, mysteries, user] = await Promise.all([rankingPage({ venueIds:scope.ids,recent:true,page }),rankingPage({ venueIds:scope.ids,unknown:true,limit:6 }),getEmailUser()]);
  const meals = [...new Map([...recent.dishes,...mysteries.dishes].map(dish=>[dish.id,dish])).values()];
  const myVotes = user ? await getUserVotes(meals.map(dish=>dish.id),user.userId) : {};
  const courtDates = todayAndYesterdayInParis();
  const stateKey = `${scope.query}:${recent.page}:${JSON.stringify(myVotes)}:${meals.map(d=>`${d.id}:${d.votes}`).join(",")}`;
  return <><HomePrototype key={stateKey} meals={meals} courtDates={courtDates} recentIds={recent.dishes.map(dish=>dish.id)} authenticated={Boolean(user)} myVotes={myVotes} venueQuery={scope.query} needsVenue={scope.pending || scope.invalid || scope.ids?.length===0} scopeControl={<VenueScopeControl options={scope.options} selectedIds={scope.ids} invalid={scope.invalid} pending={scope.pending} />} /><ResultPages path="/" query={scope.query} page={recent.page} total={recent.total} size={rankingPageSize} en={await getLocale()==="en"} /></>;
}
