import { RankingsView } from "@/components/crous/RankingsView";
import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, listRankings } from "@/lib/ranking-service";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const [dishes, user] = await Promise.all([listRankings(), getEmailUser()]);
  const reviewedDishIds = user ? await getUserVotes(dishes.map((dish) => dish.id), user.userId) : {};
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader authenticated={Boolean(user)} /><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><p className="font-mono text-sm font-bold text-verdict">长期判决</p><h1 className="mt-2 text-4xl font-black">从夯到拉排行榜</h1><p className="mt-3 text-ink/65">同一道菜，在哪天、哪个食堂撞见都算同一位嫌疑人。每次被观测都添一份证物，所有有效票一起把它送进该待的档位。</p><RankingsView dishes={dishes} authenticated={Boolean(user)} reviewedDishIds={reviewedDishIds} /></main></div>;
}
