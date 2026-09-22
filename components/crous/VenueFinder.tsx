"use client";
import { useState } from "react";
import { VenuePicker } from "./VenuePicker";
import { saveVenuePreference, type VenueOption } from "@/lib/venue-preference";

export function VenueFinder({ locale }: { locale: "zh" | "en" }) {
  const en = locale === "en";
  const [selected, setSelected] = useState<VenueOption[]>([]);
  function choose(ids: string[], options: VenueOption[]) { saveVenuePreference(ids); setSelected(options); }
  const query = new URLSearchParams(); selected.forEach(venue=>query.append("venue",venue.id));
  return <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-5"><p className="inline-block -rotate-1 bg-[#a74436] px-2.5 py-1 font-mono text-sm font-bold text-white">CROUS · FRANCE</p><h1 className="mt-3 text-4xl font-black">{en ? "Crime scene" : "案发地点"}</h1><p className="mt-2 text-ink/65">{en ? "Which venue are we judging today?" : "今天，在哪家餐厅开庭？"}</p></header>
    <section className="rounded-lg border-2 border-ink/25 bg-paper p-4 shadow-[4px_4px_0_#20262420]"><VenuePicker options={[]} onSelect={choose} compact={false} /></section>
    {selected.length > 0 && <section aria-live="polite" className="mt-6 border-2 border-ink bg-accent/20 p-5"><h2 className="text-lg font-bold">{en ? "Selected" : "已选地点"}</h2><p className="mt-2">{selected.map(venue=>venue.name).join(" / ")}</p><div className="mt-3 flex flex-wrap gap-4"><a className="inline-flex min-h-11 items-center font-bold underline" href={`/?${query}`}>{en ? "View dishes" : "查看菜品"}</a><a className="inline-flex min-h-11 items-center font-bold underline" href={`/upload?${query}`}>{en ? "Submit a meal" : "上传餐盘"}</a></div></section>}
    <details className="mt-8 text-sm text-ink/65"><summary className="min-h-11 cursor-pointer py-3 font-bold">{en ? "Coverage and location" : "收录范围与定位说明"}</summary><div className="space-y-3"><p>{en ? "985 directory entries from 26 CROUS feeds, checked 23 September 2026. These include university restaurants, cafés and other outlets; listing does not guarantee current opening or access." : "2026 年 9 月 23 日核对 26 个 CROUS 数据源，共 985 条目录记录，包含大学食堂、简餐店及其他网点；收录不代表当前营业或对所有人开放。"}</p><p>{en ? "70 records with missing or conflicting coordinates are excluded from nearby search, but remain searchable by name / CROUS. Dembeni in Mayotte is listed with incomplete location details." : "70 条坐标缺失或与地址冲突的记录不参与附近搜索，仍可通过名称／CROUS 查找；Mayotte 的 Dembeni 网点已收录，地点资料尚不完整。"}</p><p>{en ? "Your position stays in this page and is not sent to our server. Distances are approximate straight-line distances." : "设备位置只在本页计算，不发送到服务器；附近距离为直线估算值。"}</p><p><a className="underline" href="https://www.data.gouv.fr/datasets/restaurants-brasseries-et-cafeterias-des-crous" target="_blank" rel="noreferrer">CNOUS · Licence Ouverte</a> · <a className="underline" href="https://geo.api.gouv.fr/" target="_blank" rel="noreferrer">API Découpage administratif</a></p></div></details>
  </main>;
}
