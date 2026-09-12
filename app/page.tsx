import { HomePrototype } from "@/components/crous/HomePrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, listRankings } from "@/lib/ranking-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meals, user] = await Promise.all([listRankings(), getEmailUser()]);
  const myVotes = user ? await getUserVotes(meals.map((dish) => dish.id), user.userId) : {};
  const stateKey = `${Boolean(user)}:${JSON.stringify(myVotes)}:${meals.map((dish) => `${dish.id}:${dish.tier}:${dish.votes}:${dish.distribution.join(",")}`).join("|")}`;
  return <HomePrototype key={stateKey} meals={meals} authenticated={Boolean(user)} myVotes={myVotes} />;
}
