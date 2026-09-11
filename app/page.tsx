import { HomePrototype } from "@/components/crous/HomePrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVote, listRankings } from "@/lib/ranking-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meals, user] = await Promise.all([listRankings(), getEmailUser()]);
  const myVote = user && meals[0] ? await getUserVote(meals[0].id, user.userId) : null;
  const stateKey = `${Boolean(user)}:${myVote ?? 0}:${meals.map((dish) => `${dish.id}:${dish.tier}:${dish.votes}:${dish.distribution.join(",")}`).join("|")}`;
  return <HomePrototype key={stateKey} meals={meals} authenticated={Boolean(user)} myVote={myVote} />;
}
