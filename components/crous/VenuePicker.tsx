"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { matchVenue, maxVenueSelection, nearbyVenues, venueResultPageSize, type VenueOption } from "@/lib/venue-preference";
import { validCoordinates } from "@/lib/venue-search";
import { loadVenueCatalog } from "@/lib/venue-catalog-client";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ArrowLeft, ArrowRight, ExternalLink, LocateFixed, Search, SlidersHorizontal } from "lucide-react";

export function VenuePicker({ options, onSelect, autoLocate = false, compact = true }: { options: VenueOption[]; onSelect: (ids: string[], selected: VenueOption[]) => void; autoLocate?: boolean; compact?: boolean }) {
  const en = useLocale() === "en";
  const filterId = useId();
  const [catalog, setCatalog] = useState(options);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [crous, setCrous] = useState("");
  const [page, setPage] = useState(0);
  const [matches, setMatches] = useState<ReturnType<typeof nearbyVenues> | null>(null);
  const request = useRef(0);
  const locateAfterLoad = useRef(autoLocate);
  const locateRef = useRef<(data: VenueOption[]) => void>(() => {});
  useEffect(() => {
    let alive = true;
    loadVenueCatalog().then(data => {
      if (!alive) return;
      setCatalog(data); setReady(true); setLoading(false);
      if (locateAfterLoad.current) { locateAfterLoad.current = false; locateRef.current(data); }
    }).catch(() => { if (alive) { setLoading(false); setError(en ? "Directory unavailable. Retry." : "地点目录暂时不可用，请重试。"); } });
    const current = request;
    return () => { alive = false; current.current++; };
  }, [retry, en]);
  function locate(data = catalog) {
    if (!navigator.geolocation || !window.isSecureContext) { setError(en ? "Location unavailable. Search by name." : "当前无法定位，请输入餐厅名称。"); return; }
    const current = ++request.current;
    setBusy(true); setError(""); setQuery(""); setRegion(""); setCity(""); setCrous(""); setPage(0); setMatches(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (current !== request.current) return;
      setBusy(false);
      if (!validCoordinates(coords)) { setError(en ? "Invalid location. Search by name." : "未取得有效位置，请输入餐厅名称。"); return; }
      const results = nearbyVenues(data, coords); setMatches(results);
      if (!results.length) setError(en ? "No listed venues within 1 km. Search by name." : "附近 1 km 没有已收录餐厅，请按名称搜索。");
    }, () => { if (current !== request.current) return; setBusy(false); setError(en ? "Location failed. Search by name or retry." : "定位未成功，请按名称搜索或重试。"); }, { timeout: 20000, maximumAge: 60000, enableHighAccuracy: false });
  }
  useEffect(() => { locateRef.current = locate; });
  const regions = useMemo(() => [...new Map(catalog.filter(v => v.regionCode).map(v => [v.regionCode!, v.region!])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"fr")), [catalog]);
  const cities = useMemo(() => [...new Map(catalog.filter(v => region && v.regionCode === region && v.cityCode).map(v => [v.cityCode!,v.city!])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"fr")), [catalog,region]);
  const institutions = useMemo(() => [...new Map(catalog.filter(v=>v.crousId).map(v=>[v.crousId!,v.crous!])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"fr")),[catalog]);
  function searchChanged() { request.current++; locateAfterLoad.current = false; setBusy(false); setMatches(null); setError(""); setPage(0); }
  const searching = Boolean(query.trim() || region || crous);
  const results = useMemo(() => searching ? catalog.filter(v => !v.legacy && (!region || v.regionCode === region) && (!city || v.cityCode === city) && (!crous || v.crousId === crous) && matchVenue(v, query))
    .sort((a,b)=>(a.city ?? "").localeCompare(b.city ?? "","fr") || a.name.localeCompare(b.name,"fr") || a.id.localeCompare(b.id)).map(option=>({ option, distance:null })) : matches ?? [], [catalog,query,region,city,crous,searching,matches]);
  const choose = (selected: VenueOption[]) => onSelect(selected.map(v=>v.id), selected);
  const control = "min-h-11 rounded-md border border-ink/25 bg-white/70 px-3 text-base focus-visible:outline-2 focus-visible:outline-verdict";
  return <div data-venue-picker className="space-y-2 font-normal">
    <div className="flex gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">{en ? "Venue name or town" : "餐厅名称或城市"}</span><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-ink/65" /><input type="search" disabled={!ready} value={query} onChange={event=>{searchChanged();setQuery(event.target.value);}} maxLength={160} placeholder={en ? "Venue or town" : "搜索餐厅、城市"} className={`w-full pl-9 ${control}`} /></label><button type="button" disabled={!ready} onClick={()=>busy ? searchChanged() : locate()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-[#a74436] px-3 text-sm font-bold text-white hover:brightness-90 disabled:opacity-50"><LocateFixed aria-hidden="true" className={`size-4 ${busy ? "animate-pulse" : ""}`} />{busy ? (en ? "Cancel" : "取消") : (en ? "Near me" : "附近 1 km")}</button></div>
    <details data-venue-filters className="group/filters"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-ink/65 [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden="true" className="size-4" />{en ? "Region / city / CROUS" : "大区 / 城市 / CROUS"}{(region || city || crous) && <span className="rounded bg-accent px-2 py-0.5 text-ink">{en ? "Filtered" : "已筛选"}</span>}<span aria-hidden="true" className="ml-auto group-open/filters:rotate-180">⌄</span></summary>
      <div className="mb-2 grid grid-cols-2 gap-2 rounded-md bg-ink/5 p-2 [&_[data-slot=native-select-wrapper]]:w-full">
        <div className="min-w-0"><label htmlFor={`${filterId}-region`} className="mb-1 block text-sm font-bold text-ink/70">{en ? "Region" : "行政大区"}</label><NativeSelect id={`${filterId}-region`} value={region} onChange={event=>{searchChanged();setRegion(event.target.value);setCity("");}} className={`w-full ${control}`}><NativeSelectOption value="">{en ? "All regions" : "全部大区"}</NativeSelectOption>{regions.map(([id,name])=><NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}</NativeSelect></div>
        <div className="min-w-0"><label htmlFor={`${filterId}-city`} className="mb-1 block text-sm font-bold text-ink/70">{en ? "City" : "城市"}</label><NativeSelect id={`${filterId}-city`} value={city} disabled={!region} onChange={event=>{searchChanged();setCity(event.target.value);}} className={`w-full ${control}`}><NativeSelectOption value="">{region ? (en ? "All cities" : "全部城市") : (en ? "Choose region first" : "先选大区")}</NativeSelectOption>{cities.map(([id,name])=><NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}</NativeSelect></div>
        <div className="col-span-2 min-w-0"><label htmlFor={`${filterId}-crous`} className="mb-1 block text-sm font-bold text-ink/70">{en ? "CROUS organization" : "CROUS 机构"}</label><NativeSelect id={`${filterId}-crous`} value={crous} onChange={event=>{searchChanged();setCrous(event.target.value);}} className={`w-full ${control}`}><NativeSelectOption value="">{en ? "All CROUS" : "全部 CROUS"}</NativeSelectOption>{institutions.map(([id,name])=><NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}</NativeSelect></div></div>
    </details>
    {loading && <p role="status" className="text-sm text-ink/60">{en ? "Loading venues…" : "正在加载地点…"}</p>}
    {error && <p role="alert" className="rounded border-l-3 border-verdict bg-verdict/10 p-2 text-sm text-ink">{error}</p>}
    {!ready && !loading && <button type="button" className={control} onClick={()=>{setLoading(true);setError("");setRetry(value=>value+1);}}>{en ? "Retry" : "重试"}</button>}
    {results.length > 0 && <><ul className={`${compact ? "max-h-44" : "max-h-80"} overflow-y-auto overscroll-contain rounded-md border border-ink/15 bg-white/40 divide-y divide-ink/10`}>{results.slice(page*venueResultPageSize,(page+1)*venueResultPageSize).map(({option,distance})=><li key={option.id} data-venue-id={option.id} className="flex items-center hover:bg-accent/25"><button type="button" onClick={()=>choose([option])} className="min-w-0 flex-1 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-verdict"><span className="flex min-w-0 items-start gap-2"><strong className="min-w-0 flex-1 text-base leading-5">{option.name}</strong><span className={`shrink-0 rounded px-1.5 text-sm font-bold ${option.type === "ru" ? "bg-[#dbe8eb] text-[#274e59]" : "bg-accent/55 text-[#674719]"}`}>{option.type === "ru" ? "RU" : option.type === "cafeteria" ? "Café" : option.type}</span></span><span title={option.address ?? option.city ?? ""} className="mt-1 block truncate text-sm text-ink/65">{distance !== null ? `${Math.round(distance)} m · ` : ""}{option.address || option.city}</span>{Boolean(option.warnings?.length) && <span className="mt-1 block text-sm font-semibold text-[#9b3b31]">{option.warnings?.includes("source_record_missing") ? (en ? "Listing status needs checking" : "收录状态待核实") : (en ? "Location needs checking" : "地点资料待核实")}</span>}</button>{option.officialUrl && <a aria-label={`${en ? "CROUS website" : "CROUS 官网"} · ${option.name}`} title={en ? "CROUS website" : "CROUS 官网"} className="grid min-h-11 w-11 shrink-0 place-items-center text-ink/60 hover:text-verdict" href={option.officialUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" className="size-4" /></a>}</li>)}</ul>
      <div className="flex min-h-11 items-center justify-between text-sm"><span role="status" className="text-ink/60">{page*venueResultPageSize+1}–{Math.min((page+1)*venueResultPageSize,results.length)} / {results.length}{!searching && matches ? (en ? " · nearest first" : " · 由近到远") : ""}</span><div className="flex gap-1"><button type="button" aria-label={en ? "Previous" : "上一页"} disabled={!page} onClick={()=>setPage(value=>value-1)} className="grid size-11 place-items-center rounded hover:bg-accent/40 disabled:opacity-25"><ArrowLeft className="size-4" /></button><button type="button" aria-label={en ? "Next 12" : "再看 12 家"} disabled={(page+1)*venueResultPageSize>=results.length} onClick={()=>setPage(value=>value+1)} className="grid size-11 place-items-center rounded hover:bg-accent/40 disabled:opacity-25"><ArrowRight className="size-4" /></button></div></div></>}
    {!searching && matches && matches.length > 0 && matches.length <= maxVenueSelection && <button type="button" onClick={()=>choose(matches.map(item=>item.option))} className="min-h-11 w-full rounded-md bg-accent px-3 text-sm font-bold text-ink">{en ? "Use all nearby venues" : "使用以上附近餐厅"}</button>}
    {ready && !results.length && !error && <p className="pb-1 text-sm text-ink/60">{searching ? (en ? "No matching venues." : "没有匹配餐厅，请调整筛选。") : (en ? "Search a name, or find venues nearby." : "输入名称搜索，或查看附近餐厅。")}</p>}
  </div>;
}
