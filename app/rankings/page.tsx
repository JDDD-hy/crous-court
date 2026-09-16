
import { getT } from "@/lib/i18n/server";
import { RankingsView } from "@/components/crous/RankingsView";
import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";
import { getUserVotes, listRankings } from "@/lib/ranking-service";
import { getVenueScope } from "@/lib/venue-scope";
import { VenueRequiredNotice, VenueScopeControl } from "@/components/crous/VenueScopeControl";

export const dynamic = "force-dynamic";

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ venue?: string | string[] }> }) {
  const t = await getT();
  const scope = await getVenueScope((await searchParams).venue, true);
  const [dishes, user] = await Promise.all([listRankings(undefined, scope.ids), getEmailUser()]);
  const reviewedDishIds = user ? await getUserVotes(dishes.map((dish) => dish.id), user.userId) : {};
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader authenticated={Boolean(user)} venueQuery={scope.query} scopeControl={<VenueScopeControl options={scope.options} selectedIds={scope.ids} invalid={scope.invalid} pending={scope.pending} />} /><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><p className="font-mono text-sm font-bold text-verdict">{t("长期判决")}</p><h1 className="mt-2 text-4xl font-black">{t("从夯到拉排行榜")}</h1>{scope.pending || scope.invalid || scope.ids?.length === 0 ? <VenueRequiredNotice /> : <RankingsView dishes={dishes} authenticated={Boolean(user)} reviewedDishIds={reviewedDishIds} />}</main></div>;
}
