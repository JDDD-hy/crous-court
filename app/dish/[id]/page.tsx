import { DishPrototype } from "@/components/crous/DishPrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getDishDetail, getUserVote } from "@/lib/ranking-service";
import { notFound } from "next/navigation";
import { listNameSuggestions } from "@/lib/governance/naming-service";

export const dynamic = "force-dynamic";

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dish, user] = await Promise.all([getDishDetail(id), getEmailUser()]);
  if (!dish) notFound();
  const myVote = user ? await getUserVote(dish.id, user.userId) : null;
  const nameSuggestions = await listNameSuggestions(dish.id);
  return <DishPrototype key={`${dish.id}:${dish.tier}:${dish.votes}:${myVote}`} dish={dish} authenticated={Boolean(user)} myVote={myVote} nameSuggestions={nameSuggestions} />;
}
