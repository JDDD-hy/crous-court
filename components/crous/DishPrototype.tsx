"use client";

import { useState } from "react";
import { CalendarDays, History, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DishDetail } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { SiteHeader } from "./SiteHeader";
import { DishEvidence } from "./DishEvidence";
import { VoteControls } from "./VoteControls";
import { tierById, tiers, type TierId } from "./data";

export function DishPrototype({ dish, authenticated, myVote }: { dish: DishDetail; authenticated: boolean; myVote: Tier | null }) {
  const [currentDish, setCurrentDish] = useState(dish);
  const communityTier = tierById((currentDish.tier ?? currentDish.initialTier ?? 3) as TierId);
  const initialTier = tierById((currentDish.initialTier ?? 3) as TierId);
  const statusLabel = currentDish.status === "official" ? "社区判决" : currentDish.status === "provisional" ? "临时判决" : "候审中";

  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr]">
    <DishEvidence dish={currentDish} />
    <section className="space-y-6">
      <div><p className="font-mono text-sm font-bold text-verdict">DISH · 菜品档案</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">{currentDish.name}</h1><p className="mt-2 text-xl text-ink/65">{currentDish.zh}</p></div>
      <div className="grid grid-cols-2 gap-3"><Verdict label="投稿者初判" value={`${initialTier.emoji} ${initialTier.label}`} /><Verdict label={statusLabel} value={`${communityTier.emoji} ${communityTier.label}`} strong /></div>
      <div className="flex flex-wrap gap-4 border-y-2 border-dashed border-ink/30 py-4 text-sm font-bold"><span className="flex items-center gap-1"><MapPin className="size-4" />{new Set(currentDish.servings.map((serving) => serving.venue)).size} 家餐厅</span><span className="flex items-center gap-1"><CalendarDays className="size-4" />{currentDish.servings.length} 次出餐</span><span className="flex items-center gap-1"><History className="size-4" />{currentDish.votes} 张有效票</span></div>
      <VoteControls dish={currentDish} authenticated={authenticated} myVote={myVote} onChange={setCurrentDish} />
      <DishTabs dish={currentDish} />
    </section>
  </div></main></div>;
}

function DishTabs({ dish }: { dish: DishDetail }) {
  return <Tabs defaultValue="votes"><TabsList className="h-12 w-full border-2 border-ink bg-paper p-1"><TabsTrigger value="votes" className="min-h-9 font-bold">票数分布</TabsTrigger><TabsTrigger value="history" className="min-h-9 font-bold">移动历史</TabsTrigger><TabsTrigger value="name" className="min-h-9 font-bold">群众认菜</TabsTrigger></TabsList>
    <TabsContent value="votes" className="mt-4 space-y-3">{tiers.map((tier, index) => <div key={tier.id} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3"><strong>{tier.emoji} {tier.label}</strong><div className="h-8 overflow-hidden rounded-sm border-2 border-ink bg-paper"><div className="h-full" style={{ width: `${dish.votes ? dish.distribution[index] / dish.votes * 100 : 0}%`, backgroundColor: tier.color }} /></div><span className="font-mono font-bold">{dish.distribution[index]}</span></div>)}</TabsContent>
    <TabsContent value="history" className="mt-4 border-2 border-ink bg-paper p-4 text-sm text-ink/65">暂无可展示的判决移动记录。</TabsContent>
    <TabsContent value="name" className="mt-4 border-2 border-ink bg-paper p-4"><h2 className="text-xl font-black">这盘到底是什么？</h2><p className="mt-1 text-sm text-ink/60">认菜功能筹备中；现有菜名和投稿原文不会被覆盖。</p></TabsContent>
  </Tabs>;
}

function Verdict({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`border-3 border-ink p-4 ${strong ? "rotate-1 bg-accent shadow-[4px_4px_0_#202624]" : "bg-paper"}`}><span className="block text-sm text-ink/55">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>; }
