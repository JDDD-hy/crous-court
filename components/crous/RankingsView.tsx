"use client";
import { useT } from "@/lib/i18n/client";


import { Flame } from "lucide-react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ranking } from "./HomeSections";

export function RankingsView({ dishes, authenticated, reviewedDishIds }: { dishes: DishSummary[]; authenticated: boolean; reviewedDishIds: Readonly<Record<string, Tier>> }) {
  const t = useT();
  return (
    <Tabs defaultValue="main" className="mt-8">
      <TabsList variant="line" className="h-12 border-b-2 border-ink/20">
        <TabsTrigger value="main" className="min-w-32 text-base font-black">{t("🍛 主食")}</TabsTrigger>
        <TabsTrigger value="side" className="min-w-32 text-base font-black">{t("🥄 小菜")}</TabsTrigger>
      </TabsList>
      <TabsContent value="main" className="pt-7">
        <Ranking title={t("主食夯拉榜")} icon={<Flame className="size-6" />} items={dishes.filter((dish) => dish.category === "main")} authenticated={authenticated} reviewedDishIds={reviewedDishIds} />
      </TabsContent>
      <TabsContent value="side" className="pt-7">
        <Ranking title={t("小菜捡漏榜")} icon={<span aria-hidden="true">🥄</span>} items={dishes.filter((dish) => dish.category === "side")} authenticated={authenticated} reviewedDishIds={reviewedDishIds} />
      </TabsContent>
    </Tabs>
  );
}
