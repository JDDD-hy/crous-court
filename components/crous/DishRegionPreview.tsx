"use client";

import { useEffect, useRef, useState } from "react";
import { drawDishCrop } from "@/lib/upload/dish-crop";
import type { Region } from "./AiDishRecognition";

export function DishRegionPreview({ imageUrl, region, label }: { imageUrl: string | null; region: Region; label: string }) {
  if (!imageUrl || !region) return null;
  return <CropCanvas key={`${imageUrl}:${region.x}:${region.y}:${region.width}:${region.height}`} imageUrl={imageUrl} region={region} label={label} />;
}

function CropCanvas({ imageUrl, region, label }: { imageUrl: string; region: NonNullable<Region>; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      try { drawDishCrop(canvasRef.current, image, region); setStatus("ready"); }
      catch { setStatus("error"); }
    };
    image.onerror = () => { if (!cancelled) setStatus("error"); };
    image.src = imageUrl;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [imageUrl, region]);
  return <figure className="mt-3">
    <figcaption className="mb-1 text-sm font-bold text-verdict">AI 裁出的{label}</figcaption>
    <canvas ref={canvasRef} role="img" aria-label={`${label}评分主体局部`} hidden={status !== "ready"} className="h-auto w-full max-w-72 border-3 border-verdict bg-[#ded8c9]" />
    {status === "loading" && <p className="text-sm text-ink/60" role="status">正在生成局部图…</p>}
    {status === "error" && <p className="text-sm text-verdict" role="status">局部预览生成失败，请参考上方整盘红框。</p>}
  </figure>;
}
