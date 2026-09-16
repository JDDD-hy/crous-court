"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, MapPin, Navigation, Search } from "lucide-react";
import { searchVenues, validCoordinates, type Coordinates, type Venue } from "@/lib/venue-search";
import { saveVenuePreference } from "@/lib/venue-preference";

const copy = {
  zh: {
    file: "地点档案", current: "当前案发地点", candidates: "候选案发地点", locateLabel: "从你身边找", searchLabel: "直接指定地点", help: "定位与餐厅类型说明",
    nearby: "附近 1 km", allSearch: "搜索全部餐厅，可选择 1 km 以外的地点。", noNearby: "1 km 内没有餐厅，请输入名称搜索其他餐厅。", needLocation: "点击“查找附近”查看 1 km 内的餐厅，或输入名称手动选择。", backNearby: "返回附近 1 km",
    noDistance: "尚未取得位置，当前结果未按距离排序。", byDistance: "已按直线距离由近到远排序。", byMatch: "先按搜索匹配程度排序，同等匹配时按距离排序。", waiting: "正在获取位置，通常需要几秒，最多等待约 20 秒；权限弹窗等待时间另计。你仍可搜索或取消。",
    title: "案发地点", intro: "查找附近 1 km，或直接指定一家食堂。", search: "餐厅、城市或邮编", placeholder: "例如 Escoffier、Palaiseau", locate: "查找附近", locating: "正在定位…", cancel: "取消定位", forget: "清除定位", denied: "未获定位权限，你仍可以按名称或城市搜索。", unavailable: "暂时无法定位，请搜索名称或城市。", timeout: "暂时未能取得位置。请检查系统和浏览器的位置权限，或在 Edge / Chrome 中重试；仍可直接搜索餐厅。", insecure: "当前浏览器无法使用定位，请按名称或城市搜索。", precision: "定位精度约", meters: "米", distance: "直线距离约", uncertain: "相近的地点可能在定位误差范围内，请确认具体餐厅。", privacy: "位置只用于本页计算距离，不保存到账号。", empty: "没有匹配的餐厅，试试更短的名称或城市。", count: "个匹配地点", more: "显示更多", choose: "选择", selected: "已选择", clear: "清除选择", official: "官网详情", directions: "打开地图", address: "地址待补充", warning: "官网地址存在疑点，请核对详情。", typo: "没有精确匹配，以下是相似名称。", differentiate: "RU 是大学食堂，Cafétéria 是简餐店。同名地点可能有不同的取餐区。", source: "名称与地址来自官网，营业及准入条件请查看详情。", saved: "已在此浏览器记住选择。", failedSave: "当前浏览器无法保存偏好，仍可查看地点。", note: "官网坐标仅作参考，导航不保证到达具体入口。", ru: "大学食堂", cafeteria: "简餐店", brasserie: "小餐厅", self: "自选餐厅", administrative: "职工餐厅", other: "餐饮点",
  },
  en: {
    file: "LOCATION FILE", current: "Selected crime scene", candidates: "Candidate locations", locateLabel: "Start nearby", searchLabel: "Find a specific venue", help: "About location and venue types",
    nearby: "Within 1 km", allSearch: "Search all venues, including those beyond 1 km.", noNearby: "No venues within 1 km. Search by name to choose another venue.", needLocation: "Select Find nearby to see venues within 1 km, or search by name to choose manually.", backNearby: "Back to within 1 km",
    noDistance: "No position available. Results are not sorted by distance.", byDistance: "Sorted by straight-line distance, nearest first.", byMatch: "Sorted by search relevance, then distance for equal matches.", waiting: "Finding your position may take up to about 20 seconds, excluding time waiting for permission. You can still search or cancel.",
    title: "Crime scene", intro: "Find a venue within 1 km, or choose one by name.", search: "Venue, town or postcode", placeholder: "For example Escoffier or Palaiseau", locate: "Find nearby", locating: "Finding your location…", cancel: "Cancel location request", forget: "Clear location", denied: "Location permission was not granted. You can still search by name or town.", unavailable: "Location is unavailable. Please search by name or town.", timeout: "Could not obtain your position. Check system and browser location permissions, or retry in Edge / Chrome. You can still search for a venue.", insecure: "Location is unavailable in this browser. Please search by name or town.", precision: "Location accuracy: about", meters: "m", distance: "Approx. straight-line distance", uncertain: "Nearby venues may fall within the location's margin of error. Please confirm the exact venue.", privacy: "Your position is used on this page only and is not saved to your account.", empty: "No matching venues. Try a shorter name or a town.", count: "matching venues", more: "Show more", choose: "Choose", selected: "Selected", clear: "Clear selection", official: "Official details", directions: "Open map", address: "Address unavailable", warning: "The official address may contain an error. Please check the details.", typo: "No exact matches. These names look similar.", differentiate: "RU means university dining hall; Cafétéria means café or quick meals. Similar names may refer to different service areas.", source: "Names and addresses come from the official directory. Check each venue for opening hours and access.", saved: "Choice saved in this browser.", failedSave: "This browser cannot save preferences. You can still view venues.", note: "Official coordinates are approximate and may not identify the entrance.", ru: "University dining hall", cafeteria: "Café / quick meals", brasserie: "Brasserie", self: "Self-service", administrative: "Staff restaurant", other: "Dining venue",
  },
};

function readSelection() { try { return localStorage.getItem("crous-venue-preview"); } catch { return null; } }
function subscribeSelection(notify: () => void) { window.addEventListener("storage", notify); return () => window.removeEventListener("storage", notify); }

export function VenueFinder({ venues, locale }: { venues: Venue[]; locale: "zh" | "en" }) {
  const t = copy[locale];
  const typeLabels: Record<string, string> = { ru: t.ru, cafeteria: t.cafeteria, brasserie: t.brasserie, self: t.self, administrative: t.administrative, other: t.other };
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const [position, setPosition] = useState<(Coordinates & { accuracy: number }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<"denied" | "unavailable" | "timeout" | "insecure" | null>(null);
  const storedId = useSyncExternalStore(subscribeSelection, readSelection, () => null);
  const [selectionOverride, setSelectedId] = useState<string | null | undefined>(undefined);
  const selectedId = selectionOverride === undefined ? storedId : selectionOverride;
  const [storageError, setStorageError] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const request = requestId;
    return () => { request.current++; };
  }, []);
  const searching = Boolean(query.trim());
  const matches = useMemo(() => {
    if (!query.trim() && !position) return [];
    const results = searchVenues(venues, query, position);
    return query.trim() ? results : results.filter(({ distance }) => distance !== null && distance <= 1000);
  }, [venues, query, position]);
  const selected = venues.find((venue) => venue.id === selectedId);
  function choose(id: string | null) {
    setSelectedId(id);
    saveVenuePreference(id ? [id] : ["none"]);
    try { if (id) localStorage.setItem("crous-venue-preview", id); else localStorage.removeItem("crous-venue-preview"); setStorageError(false); } catch { setStorageError(true); }
  }
  function locate() {
    if (!window.isSecureContext || !navigator.geolocation) { setLocationError("insecure"); return; }
    const current = ++requestId.current;
    setLocating(true); setLocationError(null); setPosition(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (requestId.current !== current) return;
      setLocating(false);
      if (!validCoordinates(coords) || !Number.isFinite(coords.accuracy) || coords.accuracy < 0) { setLocationError("unavailable"); return; }
      setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }); setLimit(8);
    }, (error) => {
      if (requestId.current !== current) return;
      setLocating(false); setLocationError(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable");
    }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 });
  }
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border-2 border-ink px-4 py-2 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60";
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-7 flex items-end justify-between gap-4 border-b-3 border-ink pb-6">
      <div><p className="font-mono text-sm font-bold uppercase tracking-widest text-verdict">Crous de Versailles</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{t.title}</h1><p className="mt-3 text-ink/70">{t.intro}</p></div>
      <span aria-hidden="true" className="hidden shrink-0 rotate-[-8deg] border-3 border-verdict px-4 py-2 font-mono text-lg font-black text-verdict sm:block">{t.file}</span>
    </header>

    <section aria-label={t.search} className="overflow-hidden rounded-sm border-3 border-ink bg-paper shadow-[5px_5px_0_#202624]">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="border-b-2 border-ink bg-tray p-5 text-paper sm:p-6 md:border-r-2 md:border-b-0">
          <p className="flex items-center gap-2 text-sm font-bold"><Navigation aria-hidden="true" className="size-4" />{t.locateLabel}</p>
          <p className="mt-2 text-3xl font-black">{t.nearby}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" className={`${button} bg-accent text-ink shadow-[3px_3px_0_#202624] hover:bg-paper`} disabled={locating} onClick={locate}><Navigation aria-hidden="true" className="size-4" />{locating ? t.locating : t.locate}</button>
            {locating && <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => { requestId.current++; setLocating(false); }}>{t.cancel}</button>}
            {position && <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => { requestId.current++; setLocating(false); setPosition(null); }}>{t.forget}</button>}
          </div>
        </div>
        <div className="min-w-0 p-5 sm:p-6"><p className="flex items-center gap-2 text-sm font-bold text-verdict"><Search aria-hidden="true" className="size-4" />{t.searchLabel}</p>
          <label className="mt-3 block text-sm font-bold">{t.search}<input value={query} maxLength={160} onChange={(event) => { setQuery(event.target.value); setLimit(8); }} placeholder={t.placeholder} type="search" className="mt-2 min-h-12 w-full min-w-0 rounded-sm border-2 border-ink bg-white/50 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2" /></label>
          <p className="mt-3 text-sm text-ink/65">{t.allSearch}</p>
        </div>
      </div>
      <div aria-live="polite" className="space-y-2 border-t-2 border-ink/20 px-5 py-3 text-sm sm:px-6">
        {locating && <p>{t.waiting}</p>}
        {locationError && <p role="alert" className="border-l-3 border-verdict pl-3 font-bold text-verdict">{t[locationError]}</p>}
        <p className="text-ink/70">{!position ? t.noDistance : searching ? t.byMatch : t.byDistance}</p>
        {position && <p>{t.precision} {Math.ceil(position.accuracy)} {t.meters}. {t.uncertain}</p>}
      </div>
    </section>

    {selected && <section aria-label={t.current} aria-live="polite" className="mt-7 flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-accent/25 px-5 py-4">
      <div className="min-w-0"><p className="mb-1 flex items-center gap-2 text-sm font-bold text-verdict"><Check aria-hidden="true" className="size-4" />{t.current}</p><strong className="block break-words text-lg">{t.selected}: {selected.name}</strong><p className="mt-1 text-sm text-ink/70">{storageError ? t.failedSave : t.saved}</p></div>
      <button type="button" onClick={() => choose(null)} className="min-h-11 text-sm underline underline-offset-4">{t.clear}</button>
    </section>}

    <section aria-label={t.candidates} className="mt-9">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-ink/35 pb-4"><div><h2 className="text-xl font-black">{t.candidates}</h2><p role="status" className="mt-1 font-mono text-sm text-ink/65">{matches.length} {t.count}</p></div>{searching && <button type="button" className="min-h-11 text-sm font-bold underline underline-offset-4" onClick={() => { setQuery(""); setLimit(8); }}>{t.backNearby}</button>}</div>
      {matches[0]?.approximate && <p className="mb-4 border-l-3 border-accent pl-3 text-sm">{t.typo}</p>}
      {!matches.length && <div className="border-2 border-dashed border-ink/30 bg-paper/40 px-6 py-10 text-center"><MapPin aria-hidden="true" className="mx-auto mb-3 size-7 text-verdict" /><p className="mx-auto max-w-md text-ink/75">{searching ? t.empty : position ? t.noNearby : t.needLocation}</p></div>}
      <ul className="space-y-4">{matches.slice(0, limit).map(({ venue, distance, approximate }) => <li key={venue.id} className={`overflow-hidden border-2 bg-paper shadow-[4px_4px_0_#202624] ${selectedId === venue.id ? "border-verdict" : "border-ink"}`} data-venue-id={venue.id} data-approximate={approximate}>
        <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6"><div className="min-w-0"><span className="inline-block border border-ink/25 bg-ink/5 px-2 py-1 text-sm font-bold">{typeLabels[venue.type] ?? t.other}</span><h3 className="mt-3 break-words text-xl font-black sm:text-2xl">{venue.name}</h3><p className="mt-2 break-words text-sm leading-relaxed text-ink/70">{venue.address || t.address}</p>{venue.warnings.length > 0 && <p className="mt-2 text-sm text-verdict">{t.warning}</p>}</div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">{distance !== null && <p className="text-right"><span className="block text-sm text-ink/60">{t.distance}</span><strong className="font-mono text-2xl">{distance < 1000 ? `${Math.round(distance / 10) * 10} m` : `${(distance / 1000).toFixed(1)} km`}</strong></p>}<button type="button" aria-pressed={selectedId === venue.id} className={`${button} ${selectedId === venue.id ? "border-verdict bg-verdict text-paper" : "bg-ink text-paper hover:bg-verdict"}`} onClick={() => choose(venue.id)}>{selectedId === venue.id && <Check aria-hidden="true" className="size-4" />}{selectedId === venue.id ? t.selected : t.choose}</button></div>
        </div>
        <div className="flex flex-wrap gap-x-6 border-t-2 border-dashed border-ink/20 px-5 sm:px-6"><a className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4" href={venue.officialUrl} target="_blank" rel="noreferrer">{t.official}<ArrowUpRight aria-hidden="true" className="size-3" /></a><a className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.address}`)}`} target="_blank" rel="noreferrer">{t.directions}<ArrowUpRight aria-hidden="true" className="size-3" /></a></div>
      </li>)}</ul>
      {matches.length > limit && <button type="button" className={`${button} mt-5 w-full bg-paper hover:bg-ink/5`} onClick={() => setLimit((value) => value + 8)}>{t.more}</button>}
    </section>
    <details className="mt-8 border-t border-ink/25 pt-3 text-sm text-ink/65"><summary className="min-h-11 cursor-pointer py-3 font-bold">{t.help}</summary><div className="space-y-2 pb-4"><p>{t.differentiate}</p><p>{t.privacy}</p><p>{t.source} {t.note}</p></div></details>
  </main>;
}
