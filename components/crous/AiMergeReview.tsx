"use client";
import { useT } from "@/lib/i18n/client";


/* eslint-disable @next/next/no-img-element -- authenticated R2 evidence uses runtime URLs */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MergeSuggestion } from "@/lib/ai/merge-review-schema";

export function AiMergeReview({ suggestions, act }: {
  suggestions: MergeSuggestion[]; act: (body: Record<string, unknown>) => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function run(action: string, suggestionId?: string) {
    setBusy(true);
    try { await act({ action, suggestionId }); } finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black">{t("AI 合并建议")}</h2><p className="text-sm">{t("比较最近 100 道菜的名称与别名；照片由你核对，每小时可扫描 3 次。")}</p></div>
      <Button disabled={busy} onClick={() => run("scan_merges")}>{busy ? t("正在处理…") : t("扫描相近菜品")}</Button>
    </div>
    {!suggestions.length && <p className="border-2 border-ink/20 p-4">{t("暂无待处理建议。扫描后，疑似同一道菜的记录会显示在这里。")}</p>}
    {suggestions.map((item) => <article key={item.id} className="space-y-4 border-2 border-ink bg-paper p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Evidence id={item.source_id} name={item.source_name} photo={item.source_photo} label={t("并入另一条")} />
        <Evidence id={item.target_id} name={item.target_name} photo={item.target_photo} label={t("保留这条")} />
      </div>
      <p><strong>{t("相似理由：")}</strong>{item.reason}</p><p><strong>{t("待核实：")}</strong>{item.uncertainty}</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => {
          if (confirm(t("将「{0}」合并到「{1}」？\n保留目标菜品，迁移照片行踪和投票；同一人的重复票保留较早一票。", item.source_name, item.target_name))) void run("accept_merge", item.id);
        }}>{t("采纳并合并")}</Button>
        <Button disabled={busy} variant="outline" onClick={() => run("reject_merge", item.id)}>{t("拒绝，不再推荐此配对")}</Button>
      </div>
    </article>)}
  </section>;
}

function Evidence({ id, name, photo, label }: { id: string; name: string; photo: string | null; label: string }) {
  const t = useT();
  return <div className="min-w-0"><p className="mb-2 text-sm font-bold">{label}</p>
    {photo ? <img src={`/api/photos/${photo}`} alt={t("{0}的历史餐盘照片", name)} className="mb-2 h-48 w-full border border-ink/20 object-contain" /> : <p className="mb-2 border border-ink/20 p-4">{t("暂无照片")}</p>}
    <a className="font-bold underline" href={`/dish/${id}`} target="_blank" rel="noreferrer">{name}</a>
    <p className="break-all font-mono text-sm text-ink/70">{id}</p>
  </div>;
}
