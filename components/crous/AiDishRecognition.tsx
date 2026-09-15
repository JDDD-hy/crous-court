"use client";
import { useT } from "@/lib/i18n/client";


/* eslint-disable @next/next/no-img-element -- local blob preview with AI overlays */

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Region = { x: number; y: number; width: number; height: number } | null;
export type IdentificationResult = {
  analysis_status: string;
  is_food_image: boolean;
  staple: { name: string; confidence: number; region: Region } | null;
  side_dishes: Array<{ name: string; type: string; confidence: number; region: Region }>;
  warnings: string[];
  scene_description: string;
};

export function AiDishRecognition({ image, imageUrl, onApply, onResult }: { image: File | null; imageUrl: string | null; onApply: (main: string, sides: string[]) => void; onResult: (result: IdentificationResult | null) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IdentificationResult | null>(null);

  async function identify() {
    if (!image) return;
    setBusy(true); setError("");
    const body = new FormData(); body.set("image", image);
    try {
      const response = await fetch("/api/ai/identify", { method: "POST", body });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(t("识别请求返回 HTTP {0}，未收到网站的识别结果", response.status));
      const payload = await response.json() as { data: IdentificationResult | null; error: string | null; code?: string; requestId?: string };
      if (!response.ok || !payload.data) throw new Error(`${payload.error ?? t("识别失败")}（HTTP ${response.status}${payload.code ? ` / ${payload.code}` : ""}）${payload.requestId ? t("；请求编号：{0}", payload.requestId) : ""}`);
      setResult(payload.data); onResult(payload.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("AI 识菜暂时不可用")); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 border-2 border-dashed border-ink/35 bg-[#ded8c9] p-4">
    <div className="flex items-center justify-between gap-3"><div><strong className="flex items-center gap-2"><Bot className="size-5" />{t("饿晕了？让 AI 指认")}</strong><p className="text-sm text-ink/60">{t("只给候选，不会替你定案。")}</p></div><Button type="button" onClick={identify} disabled={!image || busy}>{busy ? t("AI 正在看盘…") : t("开始识别")}</Button></div>
    {error && <p role="alert" className="mt-3 break-words text-sm font-bold text-verdict">{t(error)}</p>}
    {result && <div className="mt-4 border-t border-ink/25 pt-3">{imageUrl && <AnnotatedMeal imageUrl={imageUrl} result={result} />}<p className="mt-3">{result.scene_description || t("AI 没敢描述这盘。")}</p><p className="mt-2 text-sm"><strong>{t("主食：")}</strong>{result.staple?.name ?? t("没认出来")}　<strong>{t("小菜：")}</strong>{result.side_dishes.map((dish) => dish.name).join("、") || t("未发现")}</p>
      {result.side_dishes.length > 2 && <p className="mt-2 text-sm font-bold text-verdict">{t("看到了超过两份小菜；采用后会展开额外小菜，逐份确认即可。")}</p>}
      <div className="mt-3 flex gap-2"><Button type="button" size="sm" onClick={() => onApply(result.staple?.name ?? "", result.side_dishes.map((dish) => dish.name))}>{t("采用这些候选")}</Button><Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); onResult(null); }}>{t("认错了，我自己来")}</Button></div>
    </div>}
  </div>;
}

function AnnotatedMeal({ imageUrl, result }: { imageUrl: string; result: IdentificationResult }) {
  const t = useT();
  const items = [result.staple && { label: t("主食"), region: result.staple.region }, ...result.side_dishes.map((dish, index) => ({ label: t("小菜 {0}", index + 1), region: dish.region }))].filter((item): item is { label: string; region: NonNullable<Region> } => Boolean(item?.region));
  return <div className="relative inline-block max-w-full overflow-hidden border-2 border-ink bg-paper"><img src={imageUrl} alt={t("AI 标注的餐盘评分主体")} className="block max-h-64 max-w-full" />{items.map(({ label, region }) => <span key={label} className="absolute border-3 border-verdict bg-verdict/10" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}><b className="absolute -top-7 left-0 whitespace-nowrap bg-verdict px-2 py-1 text-xs text-white">{label}</b></span>)}</div>;
}
