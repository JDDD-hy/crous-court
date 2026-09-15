"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { matchVenue, nearbyVenues, type VenueOption } from "@/lib/venue-preference";
import { validCoordinates } from "@/lib/venue-search";

export function VenuePicker({ options, onSelect, autoLocate = false }: { options: VenueOption[]; onSelect: (ids: string[]) => void; autoLocate?: boolean }) {
  const en = useLocale() === "en";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ReturnType<typeof nearbyVenues> | null>(null);
  const request = useRef(0);
  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) { setError(en ? "Location unavailable. Search by name." : "当前无法定位，请输入餐厅名称。"); setManual(true); return; }
    const current = ++request.current;
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (current !== request.current) return;
      setBusy(false);
      if (!validCoordinates(coords)) { setError(en ? "Invalid location. Search by name." : "未取得有效位置，请输入餐厅名称。"); setManual(true); return; }
      const results = nearbyVenues(options, coords); setMatches(results);
      if (!results.length) { setError(en ? "No listed venues within 1 km. Search by name." : "附近 1 km 没有已收录餐厅，请按名称搜索。"); setManual(true); }
    }, () => { if (current !== request.current) return; setBusy(false); setManual(true); setError(en ? "Location failed. Search by name or retry." : "定位未成功，请按名称搜索或重试。"); }, { timeout: 20000, maximumAge: 60000, enableHighAccuracy: false });
  }
  useEffect(() => {
    // Geolocation is an external subscription started on entering this step.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoLocate) locate();
    const current = request;
    return () => { current.current++; };
    // Start once on entering the authenticated location step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const results = query.trim() ? options.filter(option => !option.legacy && matchVenue(option, query)) : [];
  return <div className="space-y-3 font-normal">
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={locate} className="min-h-11 border-2 border-ink bg-accent px-3 font-bold">{busy ? (en ? "Finding location…" : "正在定位…") : (en ? "Within 1 km" : "附近 1 km")}</button><button type="button" onClick={() => setManual(!manual)} className="min-h-11 px-3 underline">{en ? "+ Search by name" : "+ 自己输入"}</button>{busy && <button type="button" onClick={() => { request.current++; setBusy(false); }} className="min-h-11 px-3 underline">{en ? "Cancel" : "取消定位"}</button>}</div>
    {error && <p role="alert" className="text-sm text-verdict">{error}</p>}
    {matches && matches.length > 0 && <div><p className="text-sm text-ink/65">{en ? "Within 1 km, nearest first. Distances are approximate." : "附近 1 km，按距离从近到远；距离为估算值。"}</p><ul className="max-h-52 overflow-y-auto divide-y divide-ink/15">{matches.map(({ option, distance }) => <li key={option.id}><button type="button" onClick={() => onSelect([option.id])} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"><span>{option.name}</span><span className="shrink-0 text-sm">{Math.round(distance)} m</span></button></li>)}</ul><button type="button" onClick={() => onSelect(matches.map(item => item.option.id))} className="mt-2 min-h-11 border-2 border-ink px-3 font-bold">{en ? "Use all nearby venues" : "使用以上附近餐厅"}</button></div>}
    {manual && <div><label className="block text-sm font-bold">{en ? "Venue name or town" : "餐厅名称或城市"}<input value={query} onChange={event => setQuery(event.target.value)} maxLength={160} className="mt-2 min-h-11 w-full border-2 border-ink bg-transparent px-3" /></label><ul className="max-h-52 overflow-y-auto divide-y divide-ink/15">{results.map(option => <li key={option.id}><button type="button" onClick={() => onSelect([option.id])} className="min-h-11 w-full py-2 text-left"><strong className="block">{option.name}</strong><span className="text-sm text-ink/65">{option.address}</span></button></li>)}</ul>{query.trim() && !results.length && <p className="mt-2 text-sm">{en ? "No listed venue matches this name." : "目录中没有匹配的餐厅。"}</p>}</div>}
  </div>;
}
