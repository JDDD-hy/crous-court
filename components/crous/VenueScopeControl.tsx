"use client";
import { MapPin } from "lucide-react";
import { useLocale } from "@/lib/i18n/client";
import { saveVenuePreference, type VenueOption } from "@/lib/venue-preference";
import { VenuePicker } from "./VenuePicker";

export function VenueRequiredNotice() {
  const en = useLocale() === "en";
  return <section data-venue-required="true" className="mx-auto max-w-4xl px-6 py-16 text-center"><h1 className="text-3xl font-black">{en ? "Choose a crime scene first" : "先选择案发地点"}</h1><p className="mt-3 text-ink/65">{en ? "Find venues within 1 km or search by name, then view their dishes." : "选择附近 1 km 的餐厅，或按名称指定地点，再查看对应菜品。"}</p><button type="button" className="mt-5 min-h-11 border-2 border-ink bg-accent px-4 font-bold" onClick={() => { const menu = document.querySelector<HTMLDetailsElement>("header details"); if (menu) { menu.open = true; menu.querySelector("summary")?.focus(); } }}>{en ? "Choose venues" : "选择案发地点"}</button></section>;
}

export function VenueScopeControl({ options, selectedIds, invalid, pending }: { options: VenueOption[]; selectedIds?: string[]; invalid: boolean; pending: boolean }) {
  const en = useLocale() === "en";
  function select(ids: string[]) {
    saveVenuePreference(ids.length ? ids : ["none"]);
    const url = new URL(location.href); url.searchParams.delete("venue");
    for (const id of ids.length ? ids : ["none"]) url.searchParams.append("venue", id);
    location.assign(url.pathname + url.search);
  }
  const names = selectedIds === undefined ? (en ? "All venues" : "全部案发地点") : selectedIds.map(id => options.find(option => option.id === id)?.name).filter(Boolean).join(" / ");
  return <details data-venue-menu className="group" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
    <summary className="flex min-h-11 max-w-56 cursor-pointer list-none items-center gap-2 rounded-sm px-3 py-2 hover:bg-ink/5 [&::-webkit-details-marker]:hidden"><MapPin aria-hidden="true" className="size-4 shrink-0 text-verdict" /><span className="truncate">{pending || invalid || !names ? (en ? "Crime scene" : "案发地点") : `${en ? "Selected" : "已选地点"} · ${names}`}</span><span aria-hidden="true" className="group-open:rotate-180">⌄</span></summary>
    <section aria-label={en ? "Crime scene filter" : "案发地点筛选"} className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b-2 border-ink/20 bg-paper p-4 shadow-md sm:left-auto sm:right-6 sm:w-[32rem] sm:border-2">
      <VenuePicker options={options} onSelect={select} />
      <button type="button" onClick={() => select(["all"])} className="mt-3 min-h-11 text-sm underline">{en ? "All venues" : "全部案发地点"}</button>
      {invalid && <p role="alert">{en ? "Unknown venue. Choose again." : "地点无效，请重新选择。"}</p>}
      <p className="mt-2 text-sm font-normal text-ink/65">{en ? "Filters sightings by venue. Ratings include votes from all venues." : "只筛选在这些地点出现过的菜品；评分仍汇总全站投票。"}</p>
    </section>
  </details>;
}
