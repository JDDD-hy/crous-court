"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, ChevronRight, Flame, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DishSummary } from "@/lib/dish-types";
import { tierById, type TierId } from "./data";
import { SiteHeader } from "./SiteHeader";
import { TierPicker } from "./TierPicker";

export function HomePrototype({ meals }: { meals: DishSummary[] }) {
  const featured = meals[0];
  const initialTier = (featured?.tier ?? featured?.initialTier ?? 3) as TierId;
  const [displayedTier, setDisplayedTier] = useState<TierId>(initialTier);
  const [selectedTier, setSelectedTier] = useState<TierId>(initialTier);
  const [vote, setVote] = useState<TierId | null>(null);
  const [open, setOpen] = useState(false);
  const current = tierById(displayedTier);
  const initial = tierById((featured?.initialTier ?? 3) as TierId);
  const statusLabel = featured?.status === "official" ? "正式判决" : featured?.status === "provisional" ? "临时判决" : "候审中";

  function submit(next: TierId) {
    setDisplayedTier(next);
    setSelectedTier(next);
    setVote(next);
    setOpen(false);
  }

  if (!featured) {
    return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-24 text-center"><p className="text-6xl" aria-hidden="true">🍽️</p><h1 className="mt-5 text-4xl font-black">今天还没有案件</h1><p className="mt-3 text-ink/65">D1 已连接，等待第一份本地测试数据。</p></main></div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="court-grid mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative max-w-full overflow-hidden rounded-[1.4rem] border-4 border-ink bg-tray p-2 shadow-[8px_8px_0_#202624]">
            <Image src={featured.image} alt="两份肉丸古斯古斯 CROUS 餐盘" width={1206} height={678} priority className="h-28 w-full rounded-xl object-cover sm:h-[42svh] sm:min-h-72 lg:h-[68svh]" />
            <span className="absolute left-5 top-5 rotate-[-5deg] border-4 border-verdict bg-paper/90 px-3 py-1 text-lg font-black text-verdict">今日被告</span>
            <span className="absolute bottom-5 right-5 rotate-3 rounded-sm border-4 border-ink bg-paper px-3 py-2 text-xl font-black shadow-[4px_4px_0_#202624]">{current.emoji} {current.label}</span>
          </div>

          <div className="ticket relative w-full min-w-0 max-w-full overflow-hidden border-4 border-ink bg-paper p-4 shadow-[8px_8px_0_#c99a4b] sm:overflow-visible sm:p-7">
            <p className="font-mono text-sm font-bold uppercase tracking-widest text-verdict">案号 #2026-0910</p>
            <h1 className="mt-2 break-all text-2xl font-black leading-none sm:mt-3 sm:break-normal sm:text-5xl">{featured.name}</h1>
            <p className="mt-1 text-base text-ink/70 sm:mt-2 sm:text-lg">{featured.zh}</p>
            <p className="mt-2 border-y-2 border-dashed border-ink/25 py-2 text-xs font-bold sm:hidden">Escoffier · {featured.date} · 初判 😎 人上人 · {featured.votes + (vote ? 1 : 0)}票</p>
            <div className="mt-3 hidden grid-cols-2 gap-2 border-y-2 border-dashed border-ink/25 py-2 text-xs sm:mt-5 sm:grid sm:gap-3 sm:py-4 sm:text-sm">
              <Fact label="案发地点" value={featured.venue} />
              <Fact label="开庭日期" value={featured.date} />
              <Fact label="投稿者初判" value={`${initial.emoji} ${initial.label}`} />
              <Fact label={statusLabel} value={`${current.emoji} ${current.label} · ${featured.votes + (vote ? 1 : 0)} 票`} />
            </div>
            <div className="mt-3 space-y-2 sm:mt-5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
              <Button onClick={() => submit(displayedTier)} className="min-h-12 w-full min-w-0 rounded-md border-2 border-ink bg-praise px-2 text-sm font-black text-ink shadow-[4px_4px_0_#202624] hover:bg-praise/90 sm:min-h-14 sm:text-base"><Check />判得对</Button>
              <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setSelectedTier(displayedTier); }}>
                <DialogTrigger asChild><Button variant="outline" className="min-h-12 w-full min-w-0 rounded-md border-2 border-ink bg-paper px-2 text-sm font-black shadow-[4px_4px_0_#c7655f] sm:min-h-14 sm:text-base"><Scale />我有异议</Button></DialogTrigger>
                <DialogContent className="border-4 border-ink bg-paper sm:max-w-2xl">
                  <DialogHeader><DialogTitle className="text-2xl font-black">请提交你的判决</DialogTitle><DialogDescription>别只说不行。你觉得它到底是哪一档？</DialogDescription></DialogHeader>
                  <TierPicker value={selectedTier} onChange={setSelectedTier} />
                  <Button onClick={() => submit(selectedTier)} className="min-h-12 bg-ink font-black">落槌，就它了</Button>
                </DialogContent>
              </Dialog>
            </div>
            <p aria-live="polite" className="mt-2 min-h-5 text-center text-xs font-bold text-verdict sm:mt-4 sm:text-sm">{vote ? `已记录本地模拟判决：${tierById(vote).emoji} ${tierById(vote).label}` : "Phase 1 演示：不会提交真实数据"}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-12 px-4 py-14 sm:px-6">
          <Ranking title="主食夯拉榜" icon={<Flame className="size-6" />} items={meals.filter((meal) => meal.category === "main")} />
          <Ranking title="小菜捡漏榜" icon={<span aria-hidden="true">🥄</span>} items={meals.filter((meal) => meal.category === "side")} />
          <div className="grid gap-5 md:grid-cols-[1.3fr_.7fr]">
            <Link href="/dish/mystery-dessert" className="group border-4 border-dashed border-ink bg-[#ded8c9] p-6 transition-transform hover:-rotate-1">
              <p className="font-mono text-sm font-bold">悬案通缉令</p><h2 className="mt-2 text-3xl font-black">今日菜单无人取证，启动全民认菜。</h2><span className="mt-5 inline-flex items-center font-black">这盘到底是什么？<ChevronRight /></span>
            </Link>
            <div className="border-2 border-ink/40 bg-paper p-6"><p className="text-3xl">🤖🍽️</p><h2 className="mt-2 text-xl font-black">给 AI 加个菜</h2><p className="mt-2 text-sm text-ink/65">链接将在上线阶段接入。现在先把法庭审明白。</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-ink/55">{label}</span><strong>{value}</strong></div>;
}

function Ranking({ title, icon, items }: { title: string; icon: ReactNode; items: DishSummary[] }) {
  return <section><div className="mb-4 flex items-center gap-2"><span aria-hidden="true">{icon}</span><h2 className="text-3xl font-black">{title}</h2></div><div className="grid gap-4 md:grid-cols-2">{items.map((meal, index) => { const tier = tierById((meal.tier ?? meal.initialTier ?? 3) as TierId); return <Link key={meal.id} href={`/dish/${meal.id}`} className="group grid grid-cols-[7rem_1fr] overflow-hidden border-3 border-ink bg-paper shadow-[5px_5px_0_#202624] transition-transform hover:-translate-y-1"><Image src={meal.image} alt={`${meal.zh} CROUS 餐盘`} width={240} height={180} className="h-full w-full object-cover" /><div className="p-4"><p className="font-mono text-xs">#{index + 1} · {meal.venue}</p><h3 className="mt-1 text-xl font-black">{meal.zh}</h3><p className="mt-3 inline-block border-2 border-ink px-2 py-1 font-bold" style={{ backgroundColor: tier.color }}>{tier.emoji} {tier.label} · {meal.votes}票</p></div></Link>; })}</div></section>;
}
