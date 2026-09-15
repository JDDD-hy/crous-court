"use client";
import { useT } from "@/lib/i18n/client";


import { tiers, type TierId } from "./data";

export function TierPicker({ value, onChange }: { value: TierId; onChange: (tier: TierId) => void }) {
  const t = useT();
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t("选择你的判决等级")}>{tiers.map((tier) => <button key={tier.id} type="button" role="radio" aria-checked={value === tier.id} onClick={() => onChange(tier.id)} className="min-h-12 rounded-md border-2 border-ink px-3 py-2 text-left font-black transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink aria-checked:translate-y-[-2px] aria-checked:shadow-[4px_4px_0_#202624]" style={{ backgroundColor: tier.color }}><span className="mr-1" aria-hidden="true">{tier.emoji}</span>{t(tier.label)}</button>)}</div>;
}
