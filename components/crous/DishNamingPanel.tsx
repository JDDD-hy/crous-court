"use client";
import { useT } from "@/lib/i18n/client";


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type NameSuggestion = { id: string; name: string; evidenceType: string; evidenceNote: string | null; status: string; supporters: number };
const evidenceLabels: Record<string, string> = { menu_photo: "✓ 菜单取证", ate_today: "👥 当天吃过", visual_guess: "❓ 外观猜测", ai_guess: "✨ AI 猜测" };

export function DishNamingPanel({ dishId, authenticated, initialItems }: { dishId: string; authenticated: boolean; initialItems: NameSuggestion[] }) {
  const t = useT();
  const [items, setItems] = useState<NameSuggestion[]>(initialItems);
  const [name, setName] = useState("");
  const [evidenceType, setEvidenceType] = useState("ate_today");
  const [message, setMessage] = useState("");
  const load = async () => { const response = await fetch(`/api/name-suggestions?dishId=${encodeURIComponent(dishId)}`); const payload = await response.json() as { data: NameSuggestion[] | null }; setItems(payload.data ?? []); };

  async function submit() {
    setMessage("");
    const response = await fetch(`/api/dishes/${dishId}/names`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, evidenceType }) });
    const payload = await response.json() as { error: string | null };
    if (!response.ok) return setMessage(payload.error ?? t("补名失败"));
    setName(""); setMessage(t("证词已记录")); await load();
  }

  async function endorse(id: string) {
    const response = await fetch(`/api/dishes/${dishId}/names/${id}/endorse`, { method: "POST" });
    const payload = await response.json() as { error: string | null };
    setMessage(response.ok ? t("支持已记录") : payload.error ?? t("操作失败"));
    if (response.ok) await load();
  }

  return <div data-language-draft={Boolean(name)} className="mt-3 max-w-2xl border-2 border-ink bg-paper p-3"><h2 className="text-lg font-black">{t("这到底是什么？")}</h2>
    <div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item.id} className="flex items-center gap-2 border-b border-ink/20 pb-2"><span className="min-w-0 flex-1"><strong>{item.name}</strong><small className="ml-2">{t(evidenceLabels[item.evidenceType] ?? "") ?? item.evidenceType} · {item.supporters}  {t("人支持")}{item.status === "verified" ? t(" · 菜单确认") : item.status === "community" ? t(" · 群众认领") : ""}</small></span><Button type="button" size="sm" variant="outline" disabled={!authenticated} onClick={() => endorse(item.id)}>{t("我也这么认")}</Button></div>) : <p className="text-sm text-ink/60">{t("暂无证词。认错了？请大家帮忙。")}</p>}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} aria-label={t("菜品名称证词")} className="min-h-11 min-w-0 rounded border-2 border-ink bg-paper px-3" /><NativeSelect value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="min-h-11 border-2 border-ink bg-paper"><NativeSelectOption value="menu_photo">{t("菜单照片")}</NativeSelectOption><NativeSelectOption value="ate_today">{t("我当天吃了")}</NativeSelectOption><NativeSelectOption value="visual_guess">{t("根据外观猜")}</NativeSelectOption></NativeSelect><Button type="button" disabled={!authenticated || !name.trim()} onClick={submit}>{t("提交证词")}</Button></div>
    {!authenticated && <p className="mt-2 text-sm text-verdict">{t("登录后可以补名或支持候选。")}</p>}{message && <p role="status" className="mt-2 text-sm font-bold">{t(message)}</p>}
  </div>;
}
