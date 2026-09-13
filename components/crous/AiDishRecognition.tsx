"use client";

/* eslint-disable @next/next/no-img-element -- local blob preview with AI overlays */

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

type Region = { x: number; y: number; width: number; height: number } | null;
type Result = {
  analysis_status: string;
  is_food_image: boolean;
  staple: { name: string; confidence: number; region: Region } | null;
  side_dishes: Array<{ name: string; type: string; confidence: number; region: Region }>;
  warnings: string[];
  scene_description: string;
};

export function AiDishRecognition({ image, imageUrl, onApply }: { image: File | null; imageUrl: string | null; onApply: (main: string, sides: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function identify() {
    if (!image) return;
    setBusy(true); setError("");
    const body = new FormData(); body.set("image", image);
    try {
      const response = await fetch("/api/ai/identify", { method: "POST", body });
      const payload = await response.json() as { data: Result | null; error: string | null };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "识别失败");
      setResult(payload.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI 识菜暂时不可用"); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 border-2 border-dashed border-ink/35 bg-[#ded8c9] p-4">
    <div className="flex items-center justify-between gap-3"><div><strong className="flex items-center gap-2"><Bot className="size-5" />饿晕了？让 AI 指认</strong><p className="text-sm text-ink/60">只给候选，不会替你定案。</p></div><Button type="button" onClick={identify} disabled={!image || busy}>{busy ? "AI 正在看盘…" : "开始识别"}</Button></div>
    {error && <p role="alert" className="mt-3 text-sm font-bold text-verdict">{error}</p>}
    {result && <div className="mt-4 border-t border-ink/25 pt-3">{imageUrl && <AnnotatedMeal imageUrl={imageUrl} result={result} />}<p className="mt-3">{result.scene_description || "AI 没敢描述这盘。"}</p><p className="mt-2 text-sm"><strong>主食：</strong>{result.staple?.name ?? "没认出来"}　<strong>小菜：</strong>{result.side_dishes.map((dish) => dish.name).join("、") || "未发现"}</p>
      {result.side_dishes.length > 2 && <p className="mt-2 text-sm font-bold text-verdict">看到了超过两份小菜；应用时只取前两份，你仍可手动修改。</p>}
      <div className="mt-3 flex gap-2"><Button type="button" size="sm" onClick={() => onApply(result.staple?.name ?? "", result.side_dishes.slice(0, 2).map((dish) => dish.name))}>采用这些候选</Button><Button type="button" size="sm" variant="outline" onClick={() => setResult(null)}>认错了，我自己来</Button></div>
    </div>}
  </div>;
}

function AnnotatedMeal({ imageUrl, result }: { imageUrl: string; result: Result }) {
  const items = [result.staple && { label: "主食", region: result.staple.region }, ...result.side_dishes.map((dish, index) => ({ label: `小菜 ${index + 1}`, region: dish.region }))].filter((item): item is { label: string; region: NonNullable<Region> } => Boolean(item?.region));
  return <div className="relative inline-block max-w-full overflow-hidden border-2 border-ink bg-paper"><img src={imageUrl} alt="AI 标注的餐盘评分主体" className="block max-h-64 max-w-full" />{items.map(({ label, region }) => <span key={label} className="absolute border-3 border-verdict bg-verdict/10" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}><b className="absolute -top-7 left-0 whitespace-nowrap bg-verdict px-2 py-1 text-xs text-white">{label}</b></span>)}</div>;
}
