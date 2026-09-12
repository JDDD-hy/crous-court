"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = {
  analysis_status: string;
  is_food_image: boolean;
  staple: { name: string; confidence: number } | null;
  side_dishes: Array<{ name: string; type: string; confidence: number }>;
  warnings: string[];
  scene_description: string;
};

export function AiDishRecognition({ image, onApply }: { image: File | null; onApply: (main: string, sides: string[]) => void }) {
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
    {result && <div className="mt-4 border-t border-ink/25 pt-3"><p>{result.scene_description || "AI 没敢描述这盘。"}</p><p className="mt-2 text-sm"><strong>主食：</strong>{result.staple?.name ?? "没认出来"}　<strong>小菜：</strong>{result.side_dishes.map((dish) => dish.name).join("、") || "未发现"}</p>
      {result.side_dishes.length > 2 && <p className="mt-2 text-sm font-bold text-verdict">看到了超过两份小菜；应用时只取前两份，你仍可手动修改。</p>}
      <div className="mt-3 flex gap-2"><Button type="button" size="sm" onClick={() => onApply(result.staple?.name ?? "", result.side_dishes.slice(0, 2).map((dish) => dish.name))}>采用这些候选</Button><Button type="button" size="sm" variant="outline" onClick={() => setResult(null)}>认错了，我自己来</Button></div>
    </div>}
  </div>;
}
