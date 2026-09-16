"use client";
import { useT } from "@/lib/i18n/client";


/* eslint-disable @next/next/no-img-element -- authenticated R2 thumbnails use runtime URLs */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Candidate = { id: string; name: string; image: string | null; venue: string | null; date: string | null };

export function DishIdentityField({ label, name, category, value, onChange, candidateSearchEnabled }: {
  label: string; name: string; category: "main" | "side"; value: string; onChange: (value: string) => void; candidateSearchEnabled: boolean;
}) {
  const t = useT();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<(Candidate & { input: string }) | null>(null);

  useEffect(() => {
    if (!candidateSearchEnabled || !value.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/dishes/candidates?category=${category}&q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const payload = await response.json() as { data: Candidate[] | null };
        setCandidates(payload.data ?? []);
      } catch { if (!controller.signal.aborted) setCandidates([]); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [candidateSearchEnabled, category, value]);

  return <div>
    <label className="block font-bold">{label}<input name={name} value={value} onChange={(event) => { onChange(event.target.value); setSelected(null); }} maxLength={80} placeholder={t("知道就写，不知道交给群众")} className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3 font-normal" /></label>
    <input type="hidden" name={`${name.replace(/Name$/, "")}DishId`} value={selected?.input === value ? selected.id : ""} />
    {candidateSearchEnabled && value.trim() && candidates.length > 0 && <div className="mt-2 space-y-2 border-l-4 border-accent pl-3"><p className="text-sm font-bold">{t("疑似老熟人")}</p>{candidates.map((candidate) => <div key={candidate.id} className="flex items-center gap-3 border border-ink/25 bg-[#ded8c9] p-2">
      {candidate.image && <img src={candidate.image} alt={t("候选菜品历史照片")} className="size-12 object-cover" />}
      <span className="min-w-0 flex-1 text-sm"><strong className="block truncate">{candidate.name}</strong><small>{candidate.venue ?? t("历史菜品")}{candidate.date ? ` · ${candidate.date}` : ""}</small></span>
      <Button type="button" variant={selected?.id === candidate.id ? "default" : "outline"} size="sm" onClick={() => setSelected({ ...candidate, input: value })}>{selected?.id === candidate.id ? t("已认出") : t("就是它")}</Button>
    </div>)}</div>}
  </div>;
}
