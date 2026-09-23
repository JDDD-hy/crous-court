import { getRawDb } from "@/db";
import { rankingQuery, type RankingQuery } from "./ranking-query";
import { verdictFromDistribution, type Tier, type Verdict } from "./ranking";
import { getLocale } from "./i18n/server";
import { translator } from "./i18n/core";
import { venueLocation } from "./venue-location";
import type { DishSummary } from "./dish-types";

type SummaryRow = {
  group_id: string; group_size: number;
  id: string; category: DishSummary["category"]; naming_status: DishSummary["namingStatus"];
  canonical_name_fr: string | null; canonical_name_en: string | null; canonical_name_zh: string | null;
  machine_name_zh: string | null; machine_name_source: string | null; machine_name_en: string | null; machine_name_en_source: string | null;
  original_description: string; alias_name: string | null; photo_id: string | null;
  venue_name: string; venue_nickname: string; venue_id: string; venue_address: string | null; timezone: string;
  served_on: string; initial_tier: Tier; n1: number; n2: number; n3: number; n4: number; n5: number; total_count: number;
};
const fixtureImages: Record<string, string> = { "couscous-boulettes": "/meals/couscous.jpg", "lentilles-saucisse": "/meals/lentilles-saucisse.jpg", "mystery-dessert": "/meals/poulet-haricots.jpg" };

export async function rankingPage(input: RankingQuery = {}) {
  if (input.venueIds && !input.venueIds.length) return { dishes: [], total: 0, page: 1 };
  const query = rankingQuery(input);
  const locale = await getLocale();
  const t = translator(locale);
  const result = await getRawDb().prepare(query.sql).bind(...query.bindings).all<SummaryRow>();
  if (!result.results.length && (input.page ?? 1) > 1) return rankingPage({ ...input, page: 1 });
  const dishes = result.results.map((row): DishSummary => {
    const distribution: Verdict["distribution"] = [row.n1, row.n2, row.n3, row.n4, row.n5];
    const verdict = verdictFromDistribution(distribution);
    return {
      id: row.id, groupId: row.group_id, groupSize: row.group_size, venueId: row.venue_id, category: row.category, namingStatus: row.naming_status,
      canonicalNameFr: row.canonical_name_fr, canonicalNameEn: row.canonical_name_en, canonicalNameZh: row.canonical_name_zh,
      machineNameZh: row.machine_name_source === (row.canonical_name_en || row.original_description) ? row.machine_name_zh : null,
      machineNameEn: row.machine_name_en_source === (row.canonical_name_zh || row.original_description) ? row.machine_name_en : null,
      originalDescription: row.original_description,
      name: row.canonical_name_fr ?? row.canonical_name_zh ?? row.alias_name ?? t("神秘菜品 #{0}", row.id.slice(-4)),
      zh: row.canonical_name_zh ?? row.alias_name ?? (row.original_description || t("等待群众认菜")),
      venue: locale === "en" || row.venue_nickname === row.venue_name ? row.venue_name : `${row.venue_nickname} · ${row.venue_name}`,
      venueLocation: venueLocation(row.venue_address, row.venue_id), date: row.served_on, timezone: row.timezone,
      image: row.photo_id ? `/api/photos/${row.photo_id}` : fixtureImages[row.id] ?? "/file.svg",
      initialTier: row.initial_tier, tier: verdict.tier, votes: verdict.voteCount, distribution, status: verdict.status,
    };
  });
  return { dishes, total: result.results[0]?.total_count ?? 0, page: input.page ?? 1 };
}
