"use client";

import { Button } from "@/components/ui/button";
import { DishIdentityField } from "./DishIdentityField";
import { OptionalTier } from "./DishFields";
import { DishRegionPreview } from "./DishRegionPreview";
import type { IdentificationResult } from "./AiDishRecognition";

export type ExtraSide = { slot: number; name: string };

export function ExtraSideDishes({ sides, onChange, open, onToggle, imageUrl, identification, candidateSearchEnabled }: {
  sides: ExtraSide[]; onChange: (sides: ExtraSide[]) => void;
  open: boolean; onToggle: (open: boolean) => void;
  imageUrl: string | null; identification: IdentificationResult | null; candidateSearchEnabled: boolean;
}) {
  return <details open={open} onToggle={(event) => onToggle(event.currentTarget.open)} className="mt-5 border-2 border-dashed border-ink/35 bg-[#ded8c9] p-4">
    <summary className="min-h-11 cursor-pointer py-2 font-bold">我吃得比较多/就是这么富有{sides.length > 0 ? `（额外 ${sides.length} 份）` : ""}</summary>
    <div className="mt-3 grid gap-5 sm:grid-cols-2">
      {sides.map((side, index) => <div key={side.slot}>
        <DishIdentityField label={`小菜 ${index + 3}（可选）`} name={`side${index + 3}Name`} category="side" value={side.name} onChange={(name) => onChange(sides.map((item) => item.slot === side.slot ? { ...item, name } : item))} candidateSearchEnabled={candidateSearchEnabled} />
        <DishRegionPreview imageUrl={imageUrl} region={identification?.side_dishes[side.slot - 1]?.region ?? null} label={`小菜 ${index + 3}`} />
        <OptionalTier name={`side${index + 3}Tier`} />
        <Button type="button" variant="ghost" size="sm" aria-label={`移除小菜 ${index + 3}`} className="mt-1 px-2 [@media(pointer:coarse)]:min-h-11" onClick={() => onChange(sides.filter((item) => item.slot !== side.slot))}>移除</Button>
      </div>)}
    </div>
    <Button type="button" variant="outline" size="sm" className="mt-3 px-2 [@media(pointer:coarse)]:min-h-11" disabled={sides.length >= 6} onClick={() => {
      const slot = [3, 4, 5, 6, 7, 8].find((value) => !sides.some((side) => side.slot === value));
      if (slot !== undefined) onChange([...sides, { slot, name: "" }]);
    }}>＋ 加一份</Button>
    <p className="mt-2 text-sm">最多 8 份小菜；选择初判后才会加入本次投稿。收起不会清空已填内容。</p>
  </details>;
}
