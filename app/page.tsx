import { HomePrototype } from "@/components/crous/HomePrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, listRankings } from "@/lib/ranking-service";
import { todayAndYesterdayInParis } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meals, user] = await Promise.all([listRankings(), getEmailUser()]);
  const myVotes = user ? await getUserVotes(meals.map((dish) => dish.id), user.userId) : {};
  const courtDates = todayAndYesterdayInParis();
  const stateKey = `${courtDates.join(",")}:${Boolean(user)}:${JSON.stringify(myVotes)}:${meals.map((dish) => `${dish.id}:${dish.date}:${dish.tier}:${dish.votes}:${dish.distribution.join(",")}`).join("|")}`;
  return <HomePrototype key={stateKey} meals={meals} courtDates={courtDates} authenticated={Boolean(user)} myVotes={myVotes} />;
}
