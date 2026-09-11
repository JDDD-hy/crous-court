import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Flame } from "lucide-react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { tierById, type TierId } from "./data";
import { VoteControls } from "./VoteControls";

export function HomeCourt({ dish, authenticated, myVote, onChange }: { dish: DishSummary; authenticated: boolean; myVote: Tier | null; onChange: (dish: DishSummary) => void }) {
  const current = tierById((dish.tier ?? dish.initialTier ?? 3) as TierId);
  const initial = tierById((dish.initialTier ?? 3) as TierId);
  const statusLabel = dish.status === "official" ? "社区判决" : dish.status === "provisional" ? "临时判决" : "候审中";
  return <section className="court-grid mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_.8fr]">
    <div className="relative max-w-full overflow-hidden rounded-[1.4rem] border-4 border-ink bg-tray p-2 shadow-[8px_8px_0_#202624]"><Image src={dish.image} alt={`${dish.zh} CROUS 餐盘`} width={1206} height={678} priority className="h-28 w-full rounded-xl object-cover sm:h-[42svh] sm:min-h-72 lg:h-[68svh]" /><span className="absolute left-5 top-5 rotate-[-5deg] border-4 border-verdict bg-paper/90 px-3 py-1 text-lg font-black text-verdict">今日被告</span><span className="absolute bottom-5 right-5 rotate-3 rounded-sm border-4 border-ink bg-paper px-3 py-2 text-xl font-black shadow-[4px_4px_0_#202624]">{current.emoji} {current.label}</span></div>
    <div className="ticket relative w-full min-w-0 max-w-full overflow-hidden border-4 border-ink bg-paper p-4 shadow-[8px_8px_0_#c99a4b] sm:overflow-visible sm:p-7"><p className="font-mono text-sm font-bold uppercase tracking-widest text-verdict">今日开庭</p><h1 className="mt-2 break-all text-2xl font-black leading-none sm:mt-3 sm:break-normal sm:text-5xl">{dish.name}</h1><p className="mt-1 text-base text-ink/70 sm:mt-2 sm:text-lg">{dish.zh}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-y-2 border-dashed border-ink/25 py-4 text-sm"><Fact label="案发地点" value={dish.venue} /><Fact label="开庭日期" value={dish.date} /><Fact label="投稿者初判" value={`${initial.emoji} ${initial.label}`} /><Fact label={statusLabel} value={`${current.emoji} ${current.label} · ${dish.votes} 票`} /></div>
      <div className="mt-5"><VoteControls dish={dish} authenticated={authenticated} myVote={myVote} onChange={onChange} /></div>
    </div>
  </section>;
}

export function HomeRankings({ meals }: { meals: DishSummary[] }) {
  return <section className="mx-auto max-w-6xl space-y-12 px-4 py-14 sm:px-6"><Ranking title="主食夯拉榜" icon={<Flame className="size-6" />} items={meals.filter((meal) => meal.category === "main")} /><Ranking title="小菜捡漏榜" icon={<span aria-hidden="true">🥄</span>} items={meals.filter((meal) => meal.category === "side")} />
    <div className="grid gap-5 md:grid-cols-[1.3fr_.7fr]"><Link href="/dish/mystery-dessert" className="group border-4 border-dashed border-ink bg-[#ded8c9] p-6 transition-transform hover:-rotate-1"><p className="font-mono text-sm font-bold">悬案通缉令</p><h2 className="mt-2 text-3xl font-black">今日菜单无人取证，启动全民认菜。</h2><span className="mt-5 inline-flex items-center font-black">这盘到底是什么？<ChevronRight /></span></Link><div className="border-2 border-ink/40 bg-paper p-6"><p className="text-3xl">🤖🍽️</p><h2 className="mt-2 text-xl font-black">给 AI 加个菜</h2><p className="mt-2 text-sm text-ink/65">功能筹备中，现在先把法庭审明白。</p></div></div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><span className="block text-ink/55">{label}</span><strong>{value}</strong></div>; }
function Ranking({ title, icon, items }: { title: string; icon: ReactNode; items: DishSummary[] }) {
  return <section><div className="mb-4 flex items-center gap-2"><span aria-hidden="true">{icon}</span><h2 className="text-3xl font-black">{title}</h2></div><div className="grid gap-4 md:grid-cols-2">{items.map((dish, index) => { const tier = tierById((dish.tier ?? dish.initialTier ?? 3) as TierId); return <Link key={dish.id} href={`/dish/${dish.id}`} className="group grid grid-cols-[7rem_1fr] overflow-hidden border-3 border-ink bg-paper shadow-[5px_5px_0_#202624] transition-transform hover:-translate-y-1"><Image src={dish.image} alt={`${dish.zh} CROUS 餐盘`} width={240} height={180} className="h-full w-full object-cover" /><div className="p-4"><p className="font-mono text-xs">#{index + 1} · {dish.venue}</p><h3 className="mt-1 text-xl font-black">{dish.zh}</h3><p className="mt-3 inline-block border-2 border-ink px-2 py-1 font-bold" style={{ backgroundColor: tier.color }}>{tier.emoji} {tier.label} · {dish.votes}票</p></div></Link>; })}</div></section>;
}
