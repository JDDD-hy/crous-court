"use client";

import { useEffect, useState } from "react";
import type { TierHistoryEntry } from "@/lib/ranking";
import { tierById, tiers } from "./data";

export function TierHistory({ entries }: { entries: TierHistoryEntry[] }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (entries.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setStep((current) => {
      if (current >= entries.length - 1) { clearInterval(timer); return current; }
      return current + 1;
    }), 1600);
    return () => clearInterval(timer);
  }, [entries]);

  if (!entries.length) return <p className="border-2 border-ink bg-paper p-4 text-sm text-ink/65">还没有有效判决。</p>;
  const active = entries[step];
  return <div className="border-2 border-ink bg-paper p-4">
    <div className="relative mx-5 pt-10" aria-label={`第 ${active.voteCount} 票后：${tierById(active.tier).label}`}>
      <div className="h-2 bg-ink/20" />
      <span className="absolute top-0 -translate-x-1/2 border-2 border-ink bg-accent px-2 py-1 font-black shadow-[3px_3px_0_#202624] transition-[left] duration-[1200ms] motion-reduce:transition-none" style={{ left: `${(active.tier - 1) * 25}%` }}>{tierById(active.tier).emoji} {tierById(active.tier).label}</span>
      <div className="mt-2 flex justify-between text-xs font-bold">{tiers.map((tier) => <span key={tier.id} aria-hidden="true">{tier.emoji}</span>)}</div>
    </div>
    <ol className="mt-5 space-y-2">{entries.map((entry, index) => <li key={`${entry.at}:${entry.voteCount}`} className={`flex items-center gap-3 border-l-4 pl-3 ${index === step ? "border-verdict font-bold text-ink" : "border-ink/20 text-ink/55"}`}><span>{tierById(entry.tier).emoji} {tierById(entry.tier).label}</span><small>第 {entry.voteCount} 票后 · {entry.at.slice(0, 16)}</small></li>)}</ol>
    {entries.length === 1 && <p className="mt-4 text-xs text-ink/55">目前只有起始判决，尚未发生等级移动。</p>}
  </div>;
}
