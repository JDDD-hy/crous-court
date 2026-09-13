"use client";

/* eslint-disable @next/next/no-img-element -- local blob preview with AI overlay */

import type { Region } from "./AiDishRecognition";

export function DishRegionPreview({ imageUrl, region, label }: { imageUrl: string | null; region: Region; label: string }) {
  if (!imageUrl || !region) return null;
  return <figure className="mt-3">
    <figcaption className="mb-1 text-xs font-bold text-verdict">AI 标出的{label}</figcaption>
    <div className="relative inline-block max-w-full overflow-hidden border-2 border-ink bg-[#ded8c9]">
      <img src={imageUrl} alt={`${label}评分主体`} className="block max-h-40 max-w-full" />
      <span aria-hidden="true" className="absolute border-3 border-verdict bg-verdict/15" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />
    </div>
  </figure>;
}
