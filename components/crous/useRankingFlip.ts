"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { isMotionReduced } from "@/lib/motion-preference";

gsap.registerPlugin(Flip);
type FlipState = Parameters<typeof Flip.from>[0];

export function useRankingFlip(orderKey: string): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef<FlipState | null>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    const cards = rootRef.current?.querySelectorAll("[data-ranking-card]");
    if (!cards?.length) return;
    animation.current?.kill();
    if (previous.current && !isMotionReduced()) animation.current = Flip.from(previous.current, { duration: 0.55, ease: "power2.inOut", absolute: false, nested: true });
    previous.current = Flip.getState(cards);
    return () => { animation.current?.kill(); };
  }, [orderKey]);
  return rootRef;
}
