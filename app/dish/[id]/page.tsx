import { DishPrototype } from "@/components/crous/DishPrototype";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getDishDetail, getUserVote } from "@/lib/ranking-service";
import { notFound } from "next/navigation";
import { listNameSuggestions } from "@/lib/governance/naming-service";
import { parseRankingPage } from "@/lib/ranking-query";

export const dynamic = "force-dynamic";

export default async function DishPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const page = (value: string | string[] | undefined) => { try { return parseRankingPage(value); } catch { return 1; } };
  const [dish, user] = await Promise.all([getDishDetail(id, page(query.evidencePage), page(query.historyPage)), getEmailUser()]);
  if (!dish) notFound();
  const myVote = user ? await getUserVote(dish.id, user.userId) : null;
  const nameSuggestions = await listNameSuggestions(dish.id);
  return <DishPrototype key={`${dish.id}:${dish.tier}:${dish.votes}:${myVote}:${dish.evidencePagination?.page}:${dish.historyPagination?.page}`} dish={dish} historyOpen={query.historyPage !== undefined} authenticated={Boolean(user)} myVote={myVote} nameSuggestions={nameSuggestions} />;
}
