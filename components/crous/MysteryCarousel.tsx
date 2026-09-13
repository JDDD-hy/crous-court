"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { DishSummary } from "@/lib/dish-types";
import { nextDefendantIndex } from "@/lib/defendant-rotation";

export function MysteryCarousel({ dishes }: { dishes: DishSummary[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dish = dishes[index % dishes.length];

  useEffect(() => {
    if (paused || dishes.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => nextDefendantIndex(current, dishes.length)), 6_000);
    return () => window.clearInterval(timer);
  }, [dishes.length, paused]);

  return <div className="relative min-w-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
    <a key={dish.id} href={`/dish/${dish.id}`} className="mystery-enter group grid h-full overflow-hidden border-4 border-dashed border-ink bg-[#ded8c9] transition-transform hover:-rotate-1 sm:grid-cols-[12rem_1fr]">
      <Image src={dish.image} alt={`${dish.zh}的待认菜品照片`} width={384} height={288} className="h-48 w-full object-cover sm:h-full" />
      <div className="p-6"><p className="font-mono text-sm font-bold">悬案通缉令 · {dish.category === "main" ? "主食" : "小菜"}</p><h2 className="mt-2 text-3xl font-black">{dish.zh}</h2><p className="mt-2 text-sm text-ink/65">{dish.date} · {dish.venue}</p><span className="mt-5 inline-flex items-center font-black">这盘到底是什么？<ChevronRight /></span></div>
    </a>
    {dishes.length > 1 && <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-paper/90 p-1 font-mono text-xs font-bold">
      <button type="button" aria-label="上一宗悬案" className="grid size-9 place-items-center" onClick={() => setIndex((current) => nextDefendantIndex(current, dishes.length, -1))}><ChevronLeft className="size-4" /></button>
      <span>{index + 1}/{dishes.length}</span>
      <button type="button" aria-label="下一宗悬案" className="grid size-9 place-items-center" onClick={() => setIndex((current) => nextDefendantIndex(current, dishes.length))}><ChevronRight className="size-4" /></button>
    </div>}
  </div>;
}
