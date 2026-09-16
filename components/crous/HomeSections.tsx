"use client";
import { DishName } from "./DishName";
import { useLocale, useT } from "@/lib/i18n/client";
import { dishPresentation } from "@/lib/i18n/dish-presentation";
import { useVenueQuery } from "@/lib/use-venue-query";


import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { tierById, type TierId } from "./data";
import { VoteControls } from "./VoteControls";
import { useRankingFlip } from "./useRankingFlip";
import { MysteryCarousel } from "./MysteryCarousel";

export function HomeCourt({ dish, authenticated, myVote, onChange, onVotingChange, onVoteConfirmed, reviewed, position, total, onPrevious, onNext }: { dish: DishSummary; authenticated: boolean; myVote: Tier | null; onChange: (dish: DishSummary) => void; onVotingChange: (active: boolean) => void; onVoteConfirmed: (dishId: string, tier: Tier) => void; reviewed: boolean; position: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const t = useT();
  const locale = useLocale();
  const labels = dishPresentation(dish, locale);
  const current = tierById((dish.tier ?? dish.initialTier ?? 3) as TierId);
  const initial = tierById((dish.initialTier ?? 3) as TierId);
  const statusLabel = dish.status === "official" ? t("社区判决") : dish.status === "provisional" ? t("临时判决") : t("候审中");
  return <section className="court-grid mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_.8fr]">
    <div className="relative max-w-full overflow-hidden rounded-[1.4rem] border-4 border-ink bg-tray p-2 shadow-[8px_8px_0_#202624]"><Image key={dish.id} src={dish.image} alt={t("{0} CROUS 餐盘", labels.card)} width={1206} height={678} priority className="h-28 w-full rounded-xl bg-ink/10 object-contain sm:h-[42svh] sm:min-h-72 lg:h-[68svh]" /><span className="absolute left-5 top-5 rotate-[-5deg] border-4 border-verdict bg-paper/90 px-3 py-1 text-lg font-black text-verdict">{t("今日被告")}</span>{authenticated && !reviewed && <NewBadge className="right-5 top-5" />}<span className="absolute bottom-5 right-5 rotate-3 rounded-sm border-4 border-ink bg-paper px-3 py-2 text-xl font-black shadow-[4px_4px_0_#202624]">{current.emoji} {t(current.label)}</span></div>
    <div className="ticket relative w-full min-w-0 max-w-full overflow-hidden border-4 border-ink bg-paper p-4 shadow-[8px_8px_0_#c99a4b] sm:overflow-visible sm:p-7"><p className="font-mono text-sm font-bold uppercase tracking-widest text-verdict">{t("今日开庭")}</p><h1 data-dish-title className="mt-2 break-all text-2xl font-black leading-none sm:mt-3 sm:break-normal sm:text-5xl"><DishName labels={labels} /></h1>
      <div className="mt-5 grid grid-cols-2 gap-3 border-y-2 border-dashed border-ink/25 py-4 text-sm"><Fact label={t("案发地点")} value={dish.venue} location={dish.venueLocation} /><Fact label={t("开庭日期")} value={dish.date} /><Fact label={t("投稿者初判")} value={`${initial.emoji} ${t(initial.label)}`} /><Fact label={statusLabel} value={t("{0} {1} · {2} 票", current.emoji, t(current.label), dish.votes)} /></div>
      <div className="mt-5"><VoteControls key={dish.id} dish={dish} authenticated={authenticated} myVote={myVote} onChange={onChange} onInteractionChange={onVotingChange} onVoteConfirmed={onVoteConfirmed} /></div>
      {total > 1 && <div className="mt-5 flex items-center justify-between border-t-2 border-dashed border-ink/25 pt-4"><button type="button" aria-label={t("上一位被告")} onClick={onPrevious} className="grid size-11 place-items-center rounded-full border-2 border-ink bg-paper hover:bg-ink/5"><ChevronLeft /></button><span className="font-mono text-sm font-bold">{t("第")} {position}  {t("案 / 共")} {total}  {t("案")}</span><button type="button" aria-label={t("下一位被告")} onClick={onNext} className="grid size-11 place-items-center rounded-full border-2 border-ink bg-paper hover:bg-ink/5"><ChevronRight /></button></div>}
    </div>
  </section>;
}

export function HomeExtras({ meals }: { meals: DishSummary[] }) {
  const t = useT();
  const mysteries = meals.filter((dish) => dish.namingStatus === "unknown" || dish.namingStatus === "suggested");
  return <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
    <div className="grid gap-5 md:grid-cols-[1.3fr_.7fr]">{mysteries.length ? <MysteryCarousel dishes={mysteries} /> : <div className="border-4 border-dashed border-ink/40 bg-[#ded8c9] p-6"><p className="font-mono text-sm font-bold">{t("悬案通缉令")}</p><h2 className="mt-2 text-3xl font-black">{t("今日暂无悬案，伙房全员有名有姓。")}</h2></div>}<SponsorCard /></div>
  </section>;
}

function SponsorCard() {
  const t = useT();
  return <a href="https://buymeacoffee.com/donghanyanx" target="_blank" rel="noopener noreferrer" className="group flex min-h-52 flex-col justify-between border-3 border-ink bg-[#f4ecb8] p-6 shadow-[5px_5px_0_#202624] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-verdict"><div><p className="text-3xl" aria-hidden="true">🤖🍽️</p><h2 className="mt-2 text-xl font-black">{t("给 AI 加个菜")}</h2><p className="mt-2 text-base text-ink/70">{t("你的一票决定菜品从夯到拉，你的赞助决定它从活着到寄。")}</p></div><span className="mt-6 inline-flex items-center font-black">{t("去投喂")}<ChevronRight className="transition-transform group-hover:translate-x-1" /></span></a>;
}

function Fact({ label, value, location }: { label: string; value: string; location?: string | null }) { return <div><span className="block text-ink/55">{label}</span><strong>{value}</strong>{location && <span data-venue-location className="mt-1 block text-xs font-normal text-ink/65">{location}</span>}</div>; }
export function Ranking({ title, icon, items, authenticated, reviewedDishIds }: { title: string; icon: ReactNode; items: DishSummary[]; authenticated: boolean; reviewedDishIds: Readonly<Record<string, Tier>> }) {
  const t = useT();
  const venueQuery = useVenueQuery();
  const locale = useLocale();
  const listRef = useRankingFlip(items.map((dish) => `${dish.id}:${dish.tier}:${dish.votes}`).join("|"));
  return <section><div className="mb-4 flex items-center gap-2"><span aria-hidden="true">{icon}</span><h2 className="text-3xl font-black">{title}</h2></div><div ref={listRef} className="grid gap-4 md:grid-cols-2">{items.length === 0 ? <p className="border-3 border-dashed border-ink/35 bg-paper p-6 text-ink/65">{t("这里还没有被观测到的菜品。")}</p> : items.map((dish, index) => { const labels = dishPresentation(dish, locale); const tier = tierById((dish.tier ?? dish.initialTier ?? 3) as TierId); return <a key={dish.id} data-ranking-card data-flip-id={dish.id} href={`/dish/${dish.id}${venueQuery}`} className="group relative grid grid-cols-[7rem_1fr] overflow-hidden border-3 border-ink bg-paper shadow-[5px_5px_0_#202624] transition-transform hover:-translate-y-1"><Image src={dish.image} alt={t("{0} CROUS 餐盘", labels.card)} width={240} height={180} className="h-full w-full object-cover" />{authenticated && reviewedDishIds[dish.id] === undefined && <NewBadge className="right-3 top-3" />}<div className="p-4"><p className="font-mono text-xs">#{index + 1} · {dish.venue}{dish.venueLocation && <span data-venue-location className="mt-1 block text-xs font-normal text-ink/65">{dish.venueLocation}</span>}</p><h3 data-dish-title className="mt-1 text-xl font-black"><DishName labels={labels} /></h3><p className="mt-3 inline-block border-2 border-ink px-2 py-1 font-bold" style={{ backgroundColor: tier.color }}>{tier.emoji} {t(tier.label)} · {dish.votes}{t("票")}</p></div></a>; })}</div></section>;
}

function NewBadge({ className }: { className: string }) {
  const t = useT(); return <span className={`absolute z-10 rotate-3 border-2 border-ink bg-[#f4ecb8] px-2 py-1 font-mono text-xs font-black shadow-[2px_2px_0_#202624] ${className}`} aria-label={t("尚未审阅")}>NEW</span>; }
