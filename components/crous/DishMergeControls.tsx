"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import type { AdminDish } from "@/lib/governance/admin-dish-search";

const nameOf = (dish: AdminDish) => dish.original_description || dish.canonical_name_zh || dish.canonical_name_en || dish.canonical_name_fr || dish.id;

export function DishMergeControls({ act }: { act: (body: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const [query, setQuery] = useState(""); const [searched, setSearched] = useState<string | null>(null);
  const [items, setItems] = useState<AdminDish[]>([]); const [next, setNext] = useState<number | null>(null);
  const [source, setSource] = useState(""); const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  async function search(q: string, offset = 0) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/dishes?${new URLSearchParams({ q, offset: String(offset) })}`, { cache: "no-store" });
      const payload = await response.json() as { data: { items: AdminDish[]; nextOffset: number | null } | null; error: string | null };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? t("菜品查询失败"));
      const data = payload.data;
      setItems((previous) => offset ? [...previous, ...data.items] : data.items); setNext(data.nextOffset); setSearched(q);
    } catch (error) { setMessage(error instanceof Error ? error.message : t("菜品查询失败")); }
    finally { setBusy(false); }
  }
  async function merge() {
    const label = (id: string) => { const dish = items.find((item) => item.id === id); return dish ? `${nameOf(dish)} (${id})` : id; };
    if (!confirm(t("将来源 {0} 合并到目标 {1}？保留目标，同账号只计一票。", label(source.trim()), label(target.trim())))) return;
    setBusy(true);
    try { await act({ action: "merge_dish", sourceDishId: source.trim(), targetDishId: target.trim() }); }
    finally { if (searched !== null) await search(searched); setBusy(false); }
  }
  async function copy(id: string) {
    try { await navigator.clipboard.writeText(id); setMessage(t("已复制 Dish ID")); }
    catch { setMessage(t("复制失败，请选中 ID 手动复制")); }
  }
  return <section className="space-y-4 border-2 border-ink bg-paper p-4" data-language-busy={busy} data-language-draft={Boolean(source || target || query)}>
    <h2 className="font-black">{t("查询菜品并合并")}</h2>
    <p className="text-sm">{t("按菜名、别名或 Dish ID 查询；留空查看全部记录。选定来源与保留目标后再确认合并。")}</p>
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(query.trim()); }}>
      <input aria-label={t("查询菜名或 Dish ID")} value={query} maxLength={160} disabled={busy} onChange={(event) => setQuery(event.target.value)} className="min-h-11 min-w-0 flex-1 border-2 border-ink px-2" placeholder={t("查询菜名或 Dish ID")} />
      <Button type="submit" disabled={busy}>{t(busy ? "查询中…" : "查询")}</Button>
    </form>
    {message && <p role="status">{message}</p>}
    {searched !== null && !items.length && <p>{t("没有匹配的菜品，请尝试更短的关键词。")}</p>}
    <div className="space-y-3">{items.map((dish) => <article key={dish.id} className="space-y-2 border border-ink/30 p-3">
      <strong className="break-words">{nameOf(dish)}</strong>
      <p className="text-sm break-words">{[...new Set([dish.canonical_name_zh, dish.canonical_name_en, dish.canonical_name_fr].filter((name) => name && name !== nameOf(dish)))].join(" · ")}</p>
      <p className="text-sm">{t(dish.category === "main" ? "主食" : "小菜")} · {t("{0} 票 · {1} 次行踪", dish.votes, dish.servings)} · {t(dish.merged_into_dish_id ? "已合并" : dish.visible ? "未合并" : "暂无可见行踪")}</p>
      <code className="block select-all break-all text-sm">{dish.id}</code>
      {dish.merged_into_dish_id && <p className="break-all text-sm">{t("合并目标")}：{dish.merged_into_dish_id}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void copy(dish.id)}>{t("复制 ID")}</Button>
        {!dish.merged_into_dish_id && <><Button size="sm" disabled={busy} onClick={() => setSource(dish.id)}>{t("填入来源")}</Button><Button size="sm" disabled={busy} onClick={() => setTarget(dish.id)}>{t("填入目标")}</Button></>}
        {!dish.merged_into_dish_id && Boolean(dish.visible) && <a className="inline-flex min-h-10 items-center underline" href={`/dish/${dish.id}`} target="_blank" rel="noreferrer">{t("查看菜品")}</a>}
      </div>
    </article>)}</div>
    {next !== null && <Button variant="outline" disabled={busy} onClick={() => void search(searched ?? "", next)}>{t("加载更多")}</Button>}
    <div className="grid gap-2 border-t border-ink/30 pt-4 sm:grid-cols-2">
      <label className="min-w-0 text-sm">{t("来源 Dish ID")}<input value={source} disabled={busy} onChange={(event) => setSource(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 border-2 border-ink px-2" /></label>
      <label className="min-w-0 text-sm">{t("目标 Dish ID")}<input value={target} disabled={busy} onChange={(event) => setTarget(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 border-2 border-ink px-2" /></label>
    </div>
    <Button disabled={busy || !source.trim() || !target.trim() || source.trim() === target.trim()} onClick={() => void merge()}>{t("合并")}</Button>
  </section>;
}
