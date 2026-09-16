"use client";
import { useT } from "@/lib/i18n/client";


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SplitControls, type SplitRepair } from "./SplitControls";
import { DishMergeControls } from "./DishMergeControls";
import { AiMergeReview } from "./AiMergeReview";
import type { MergeSuggestion } from "@/lib/ai/merge-review-schema";

export type ModerationQueue = { reports: Array<Record<string, unknown>>; names: Array<Record<string, unknown>>; merges: Array<Record<string, unknown>>; suggestions: MergeSuggestion[]; splitRepairs: SplitRepair[] };

export function AdminQueue({ initialQueue }: { initialQueue: ModerationQueue }) {
  const t = useT();
  const [queue, setQueue] = useState<ModerationQueue>(initialQueue); const [message, setMessage] = useState("");
  const load = async () => { const response = await fetch("/api/admin/queue"); const payload = await response.json() as { data: ModerationQueue | null }; if (payload.data) setQueue(payload.data); };
  async function act(body: Record<string, unknown>) {
    setMessage("");
    try {
      const response = await fetch("/api/admin/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error: string | null; data?: { scanned?: number; added?: number } };
      setMessage(response.ok ? body.action === "scan_merges" ? t("已扫描 {0} 道菜，新增 {1} 条建议；已有或拒绝的配对不会重复添加。", payload.data?.scanned ?? 0, payload.data?.added ?? 0) : t("操作已记录") : payload.error ?? t("操作失败"));
      await load();
    } catch { setMessage(t("网络或列表刷新失败，请刷新页面核对操作结果。")); }
  }
  return <>{message && <p role="status" className="mb-4 font-bold">{t(message)}</p>}<Tabs defaultValue="reports"><TabsList className="h-auto flex-wrap"><TabsTrigger value="reports">{t("举报")} {queue.reports.length}</TabsTrigger><TabsTrigger value="names">{t("待认菜")} {queue.names.length}</TabsTrigger><TabsTrigger value="ai">{t("AI 合并建议")} {queue.suggestions.length}</TabsTrigger><TabsTrigger value="records">{t("合并记录")}</TabsTrigger></TabsList>
    <TabsContent value="ai"><AiMergeReview suggestions={queue.suggestions} act={act} /></TabsContent>
    <TabsContent value="reports" className="space-y-3">{queue.reports.map((item) => <article key={String(item.id)} className="border-2 border-ink bg-paper p-4"><strong>{t(String(item.reason))}</strong><p className="text-sm">{item.details ? String(item.details) : t("无补充说明")}</p><div className="mt-3 flex flex-wrap gap-2">{typeof item.meal_id === "string" && <Button size="sm" variant="destructive" onClick={() => act({ action: "hide_meal", mealId: item.meal_id })}>{t("隐藏该餐盘")}</Button>}<Button size="sm" onClick={() => act({ action: "resolve_report", reportId: item.id })}>{t("处理完成")}</Button><Button size="sm" variant="outline" onClick={() => act({ action: "dismiss_report", reportId: item.id })}>{t("驳回")}</Button></div></article>)}{!queue.reports.length && <p>{t("当前没有待处理举报。")}</p>}</TabsContent>
    <TabsContent value="names" className="space-y-3">{queue.names.map((item) => <article key={String(item.id)} className="border-2 border-ink bg-paper p-4"><strong>{String(item.name)}</strong><p className="text-sm">{t(String(item.evidence_type))} · {String(item.supporters)}  {t("人支持")}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => act({ action: "verify_name", suggestionId: item.id, language: "en" })}>{t("确认为正式英语名")}</Button><Button size="sm" variant="outline" onClick={() => act({ action: "verify_name", suggestionId: item.id, language: "zh" })}>{t("确认为中文名")}</Button></div></article>)}</TabsContent>
    <TabsContent value="records" className="space-y-3"><DishMergeControls act={act} /><SplitControls repairs={queue.splitRepairs} act={act} />{queue.merges.map((item) => <p key={String(item.id)} className="break-all font-mono text-sm">{String(item.id)} → {String(item.merged_into_dish_id)}</p>)}</TabsContent></Tabs></>;
}
