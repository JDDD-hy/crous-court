"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { useLocale, useT } from "@/lib/i18n/client";
import { dishPresentation } from "@/lib/i18n/dish-presentation";
import { DishName } from "./DishName";
import { tierById } from "./data";

type GroupPage = { data: DishSummary[]; reviewedDishIds: Record<string, Tier>; pagination: { page: number; pageSize: number; total: number } };

export function DishStack({ dish, venueQuery, authenticated, reviewedDishIds }: { dish: DishSummary; venueQuery: string; authenticated: boolean; reviewedDishIds: Readonly<Record<string, Tier>> }) {
  const locale = useLocale(), en = locale === "en";
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<GroupPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  function beginLoad() { setLoading(true); setError(false); setResult(null); }
  const count = result?.pagination.total ?? dish.groupSize ?? 1;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams(venueQuery);
    params.set("relatedTo", dish.id); params.set("page", String(page)); params.set("category", dish.category);
    fetch(`/api/rankings?${params}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Group unavailable");
      const next = await response.json() as GroupPage;
      if (!controller.signal.aborted) { setResult(next); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setLoading(false); setError(true); } });
    return () => controller.abort();
  }, [open, page, retry, dish.id, dish.category, venueQuery]);
  const labels = dishPresentation(dish, locale);
  const grouped = (dish.groupSize ?? 1) > 1;
  const shown = open && result ? result.data : [dish];
  return <section data-dish-stack={dish.groupId ?? dish.id} data-stack-open={open} className="min-w-0 self-start">
    <header className="mb-3 flex items-start justify-between gap-2">
      <h3 data-dish-title className="min-w-0 break-words py-2 text-[1.625rem] font-black leading-tight sm:text-3xl"><DishName labels={labels} /></h3>
      {grouped && <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={en ? `${open ? "Collapse" : "Expand"} ${count} venues for ${labels.card}` : `${open ? "收起" : "展开"}${labels.card}的 ${count} 家餐厅`} onClick={() => { if (!open) beginLoad(); setOpen(value => !value); }} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded px-1 text-sm font-semibold text-[#a74436] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdict"><span>{count}{en ? <span className="sr-only sm:not-sr-only"> venues</span> : " 家"}</span><ChevronDown aria-hidden="true" className={`size-3.5 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} /></button>}
    </header>
    <div id={panelId} aria-busy={open && loading} className={`relative isolate ${grouped && !open ? "pb-3 pr-3" : ""}`}>
      {grouped && !open && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 translate-x-1 translate-y-1 rotate-1 border-3 border-ink bg-secondary" />}
      <div className="grid gap-5">{shown.map(item => <VenueDishCard key={item.id} dish={item} groupName={labels.card} venueQuery={venueQuery} authenticated={authenticated} reviewed={(result && open ? result.reviewedDishIds : reviewedDishIds)[item.id] !== undefined} />)}</div>
      {open && loading && <p role="status" className="mt-3 text-sm text-ink/65">{en ? "Loading venues…" : "正在加载餐厅…"}</p>}
      {open && error && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{en ? "Could not load venues." : "餐厅暂时加载失败。"}</span><button type="button" onClick={() => { beginLoad(); setRetry(value => value + 1); }} className="min-h-11 px-2 font-bold underline">{en ? "Retry" : "重试"}</button></div>}
      {open && result && !result.data.length && <p role="status" className="text-sm text-ink/65">{en ? "No dishes in this scope." : "当前范围内暂无菜品。"}</p>}
      {open && result && result.pagination.total > result.pagination.pageSize && <div className="mt-2 flex items-center justify-between text-sm"><span>{result.pagination.page} / {Math.ceil(result.pagination.total / result.pagination.pageSize)}</span><div className="flex gap-1"><button type="button" aria-label={en ? "Previous venues" : "上一页餐厅"} disabled={result.pagination.page === 1} onClick={() => { beginLoad(); setPage(result.pagination.page - 1); }} className="grid size-11 place-items-center rounded hover:bg-accent/20 disabled:opacity-30"><ChevronLeft aria-hidden="true" className="size-4" /></button><button type="button" aria-label={en ? "Next venues" : "下一页餐厅"} disabled={result.pagination.page * result.pagination.pageSize >= result.pagination.total} onClick={() => { beginLoad(); setPage(result.pagination.page + 1); }} className="grid size-11 place-items-center rounded hover:bg-accent/20 disabled:opacity-30"><ChevronRight aria-hidden="true" className="size-4" /></button></div></div>}
    </div>
  </section>;
}

function VenueDishCard({ dish, groupName, venueQuery, authenticated, reviewed }: { dish: DishSummary; groupName: string; venueQuery: string; authenticated: boolean; reviewed: boolean }) {
  const t = useT();
  const labels = dishPresentation(dish, useLocale());
  const tier = tierById(dish.tier ?? dish.initialTier ?? 3);
  return <a data-ranking-card data-dish-id={dish.id} data-flip-id={dish.id} href={`/dish/${dish.id}${venueQuery}`} className="relative block min-w-0 border-3 border-ink bg-paper shadow-[6px_6px_0_#202624] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-verdict">
    <div className="relative border-b-3 border-ink bg-tray">
      <Image src={dish.image} alt={t("{0} CROUS 餐盘", labels.card)} width={480} height={270} className="h-[11.5rem] w-full object-contain sm:h-52" />
      <span className="absolute left-3 top-3 -rotate-3 border-2 border-ink bg-paper px-2 py-0.5 text-sm font-black">{t("呈堂证物")}</span>
    </div>
    {authenticated && !reviewed && <span aria-label={t("尚未审阅")} className="absolute right-3 top-3 rotate-3 border-2 border-ink bg-[#f4ecb8] px-2 py-1 font-mono text-xs font-black">NEW</span>}
    <div className="p-4">{labels.card !== groupName && <h4 data-dish-title className="mb-2 break-words text-xl font-black"><DishName labels={labels} /></h4>}
      <p className="text-sm font-black text-verdict">{t("案发地点")}</p>
      <p className="mt-1 break-words text-lg font-black leading-snug">{dish.venue}</p>
      {dish.venueLocation && <p data-venue-location className="mt-1 text-xs text-ink/65">{dish.venueLocation}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-ink/30 pt-4">
        <span data-verdict-badge className="inline-flex max-w-full -rotate-2 items-center gap-2 border-3 border-ink px-3 py-1.5 font-black shadow-[3px_3px_0_#202624]" style={{ backgroundColor: tier.color }}><span aria-hidden="true" className="shrink-0 text-2xl">{tier.emoji}</span><span className="min-w-0 break-words text-2xl leading-tight sm:text-3xl">{t(tier.label)}</span></span>
        <span className="whitespace-nowrap text-sm tabular-nums"><strong className="mr-1 text-2xl font-black">{dish.votes}</strong>{t("票")}</span>
      </div>
    </div>
  </a>;
}
