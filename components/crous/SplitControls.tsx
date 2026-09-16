"use client";
import { useT } from "@/lib/i18n/client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tiers } from "./data";

export type SplitRepair = { serving_id: string; dish_id: string; name: string; initial_tier: number };

export function SplitControls({ repairs, act }: { repairs: SplitRepair[]; act: (body: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const [serving, setServing] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  async function run(body: Record<string, unknown>) { setBusy(true); try { await act(body); } finally { setBusy(false); } }
  return <>
    <div data-language-busy={busy} data-language-draft={Boolean(serving || name)} className="border-2 border-ink bg-paper p-4"><h2 className="font-black">{t("拆分行踪")}</h2>
      <p className="mt-2 text-sm">{t("投稿初评随行踪保留；无法确认归属的社区票留在原菜品。已经独立的行踪不能再次拆分。")}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input aria-label={t("待拆分的 Serving ID")} value={serving} onChange={(e) => setServing(e.target.value)} placeholder="Serving ID" className="min-h-10 min-w-0 flex-1 border-2 border-ink px-2" />
        <input aria-label={t("拆分后的菜名")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={t("新菜名")} className="min-h-10 min-w-0 flex-1 border-2 border-ink px-2" />
        <Button disabled={busy || !serving.trim() || !name.trim()} onClick={() => confirm(t("将这次行踪拆为「{0}」？投稿初评会保留，归属不明的社区票留在原菜品。", name)) && run({ action: "split_serving", servingId: serving.trim(), name })}>{busy ? t("处理中…") : t("拆分")}</Button>
      </div>
    </div>
    {repairs.length > 0 && <section className="space-y-3 border-2 border-ink bg-paper p-4"><h2 className="font-black">{t("历史拆分初评")}</h2>
      <p className="text-sm">{t("以下菜品缺少投稿者的票。按已保存的初评补回，不转移原档案里归属不明的票。")}</p>
      {repairs.map((item) => <div key={item.serving_id} className="flex flex-wrap items-center justify-between gap-2">
        <a className="min-w-0 break-words underline" href={`/dish/${item.dish_id}`}>{item.name} · {t(tiers.find((tier) => tier.id === item.initial_tier)?.label ?? String(item.initial_tier))}</a>
        <Button disabled={busy} onClick={() => confirm(t("为「{0}」补回已记录的投稿初评？同一投稿者已有票时不会重复添加。", item.name)) && run({ action: "repair_split_vote", servingId: item.serving_id })}>{t("补回投稿初评")}</Button>
      </div>)}
    </section>}
  </>;
}
