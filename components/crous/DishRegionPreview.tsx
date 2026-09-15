"use client";
import { useT } from "@/lib/i18n/client";


/* eslint-disable @next/next/no-img-element -- local blob preview with AI overlay */

import { useState } from "react";
import type { Region } from "./AiDishRecognition";

export function DishRegionPreview({ imageUrl, region, label }: { imageUrl: string | null; region: Region; label: string }) {
  const t = useT();
  const [imageRatio, setImageRatio] = useState(1);
  if (!imageUrl || !region) return null;
  const cropRatio = imageRatio * region.width / region.height;
  return <figure className="mt-3">
    <figcaption className="mb-1 text-xs font-bold text-verdict">{t("AI 裁出的")}{label}</figcaption>
    <div className="relative w-full max-w-72 overflow-hidden border-3 border-verdict bg-[#ded8c9]" style={{ aspectRatio: cropRatio }}>
      <img src={imageUrl} alt={t("{0}评分主体局部", label)} onLoad={(event) => setImageRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} className="absolute max-w-none" style={{ width: `${100 / region.width}%`, height: `${100 / region.height}%`, left: `${-100 * region.x / region.width}%`, top: `${-100 * region.y / region.height}%` }} />
    </div>
  </figure>;
}
