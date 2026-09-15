"use client";
import { DishName } from "./DishName";
import { useLocale, useT } from "@/lib/i18n/client";
import { dishPresentation } from "@/lib/i18n/dish-presentation";


import { useState } from "react";
import { CalendarDays, History, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DishDetail } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { SiteHeader } from "./SiteHeader";
import { DishEvidence } from "./DishEvidence";
import { VoteControls } from "./VoteControls";
import { DishNamingPanel } from "./DishNamingPanel";
import { TierHistory } from "./TierHistory";
import type { NameSuggestion } from "./DishNamingPanel";
import { ReportDialog } from "./ReportDialog";
import { tierById, tiers, type TierId } from "./data";

export function DishPrototype({ dish, authenticated, myVote, nameSuggestions }: { dish: DishDetail; authenticated: boolean; myVote: Tier | null; nameSuggestions: NameSuggestion[] }) {
  const t = useT();
  const [currentDish, setCurrentDish] = useState(dish);
  const labels = dishPresentation(currentDish, useLocale());
  const communityTier = tierById((currentDish.tier ?? currentDish.initialTier ?? 3) as TierId);
  const initialTier = tierById((currentDish.initialTier ?? 3) as TierId);
  const statusLabel = currentDish.status === "official" ? t("社区判决") : currentDish.status === "provisional" ? t("临时判决") : t("候审中");

  return <div className="min-h-screen bg-background"><SiteHeader authenticated={authenticated} /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr]">
    <DishEvidence dish={currentDish} />
    <section className="space-y-6">
      <div><p className="font-mono text-sm font-bold text-verdict">{t("DISH · 菜品档案")}</p><h1 data-dish-title className="mt-2 text-4xl font-black sm:text-5xl"><DishName labels={labels} /></h1><div className="mt-3"><ReportDialog dishId={currentDish.id} mealId={currentDish.servings[0]?.mealId ?? ""} authenticated={authenticated} /></div></div>
      <div className="grid grid-cols-2 gap-3"><Verdict label={t("投稿者初判")} value={`${initialTier.emoji} ${t(initialTier.label)}`} /><Verdict label={statusLabel} value={`${communityTier.emoji} ${t(communityTier.label)}`} strong /></div>
      <div className="flex flex-wrap gap-4 border-y-2 border-dashed border-ink/30 py-4 text-sm font-bold"><span className="flex items-center gap-1"><MapPin className="size-4" />{new Set(currentDish.servings.map((serving) => serving.venue)).size}  {t("家餐厅")}</span><span className="flex items-center gap-1"><CalendarDays className="size-4" />{currentDish.servings.length}  {t("次被观测")}</span><span className="flex items-center gap-1"><History className="size-4" />{currentDish.votes}  {t("张有效票")}</span></div>
      <VoteControls dish={currentDish} authenticated={authenticated} myVote={myVote} onChange={(next) => setCurrentDish((current) => ({ ...current, ...next }))} />
      <DishTabs dish={currentDish} authenticated={authenticated} nameSuggestions={nameSuggestions} />
    </section>
  </div></main></div>;
}

function DishTabs({ dish, authenticated, nameSuggestions }: { dish: DishDetail; authenticated: boolean; nameSuggestions: NameSuggestion[] }) {
  const t = useT();
  return <Tabs defaultValue="votes"><TabsList variant="line" className="h-11 w-full justify-stretch rounded-none border-b-2 border-ink/30 bg-transparent p-0"><TabsTrigger value="votes" className="min-h-11 rounded-none font-bold data-[state=active]:text-verdict">{t("票数分布")}</TabsTrigger><TabsTrigger value="history" className="min-h-11 rounded-none font-bold data-[state=active]:text-verdict">{t("移动历史")}</TabsTrigger><TabsTrigger value="name" className="min-h-11 rounded-none font-bold data-[state=active]:text-verdict">{t("群众认菜")}</TabsTrigger></TabsList>
    <TabsContent value="votes" className="mt-4 space-y-3">{tiers.map((tier, index) => <div key={tier.id} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3"><strong>{tier.emoji} {t(tier.label)}</strong><div className="h-8 overflow-hidden rounded-sm border-2 border-ink bg-paper"><div className="h-full" style={{ width: `${dish.votes ? dish.distribution[index] / dish.votes * 100 : 0}%`, backgroundColor: tier.color }} /></div><span className="font-mono font-bold">{dish.distribution[index]}</span></div>)}</TabsContent>
    <TabsContent value="history" className="mt-4"><TierHistory entries={dish.tierHistory} /></TabsContent>
    <TabsContent value="name"><DishNamingPanel dishId={dish.id} authenticated={authenticated} initialItems={nameSuggestions} /></TabsContent>
  </Tabs>;
}

function Verdict({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`border-3 border-ink p-4 ${strong ? "rotate-1 bg-accent shadow-[4px_4px_0_#202624]" : "bg-paper"}`}><span className="block text-sm text-ink/55">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>; }
