import { HomePrototype } from "@/components/crous/HomePrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, listRankings } from "@/lib/ranking-service";
import { todayAndYesterdayInParis } from "@/lib/calendar";
import { getVenueScope } from "@/lib/venue-scope";
import { VenueScopeControl } from "@/components/crous/VenueScopeControl";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ venue?: string | string[] }> }) {
  const scope = await getVenueScope((await searchParams).venue, true);
  const [meals, user] = await Promise.all([listRankings(undefined, scope.ids), getEmailUser()]);
  const myVotes = user ? await getUserVotes(meals.map((dish) => dish.id), user.userId) : {};
  const courtDates = todayAndYesterdayInParis();
  const stateKey = `${courtDates.join(",")}:${Boolean(user)}:${JSON.stringify(myVotes)}:${meals.map((dish) => `${dish.id}:${dish.date}:${dish.tier}:${dish.votes}:${dish.distribution.join(",")}`).join("|")}`;
  return <HomePrototype key={scope.query + stateKey} meals={meals} courtDates={courtDates} authenticated={Boolean(user)} myVotes={myVotes} venueQuery={scope.query} needsVenue={scope.pending || scope.invalid || scope.ids?.length === 0} scopeControl={<VenueScopeControl options={scope.options} selectedIds={scope.ids} invalid={scope.invalid} pending={scope.pending} />} />;
}
