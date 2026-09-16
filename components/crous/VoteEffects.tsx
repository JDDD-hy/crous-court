"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { isMotionReduced } from "@/lib/motion-preference";
import { getVoxelDrop, preloadVoxelDrop } from "@/lib/voxel-preload";
import { getVerdictMotion, type VoteMotionEvent } from "@/lib/verdict-motion";
import { tierById, type TierId } from "./data";
import { useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/core";

gsap.registerPlugin(MotionPathPlugin);

export function VoteEffects({ event }: { event: VoteMotionEvent | null }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => preloadVoxelDrop(), []);
  useEffect(() => {
    if (!event || !hostRef.current || isMotionReduced()) return;
    const controller = new AbortController();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (preference.matches) controller.abort(); };
    preference.addEventListener("change", stop);
    void playEffects(hostRef.current, event, controller.signal, t);
    return () => { controller.abort(); preference.removeEventListener("change", stop); };
  }, [event, t]);
  return <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />;
}

async function playEffects(host: HTMLDivElement, event: VoteMotionEvent, signal: AbortSignal, t: Translator) {
  const verdict = getVerdictMotion(event.fromTier, event.toTier);
  const stamp = document.createElement("span");
  stamp.className = "absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] border-4 border-verdict bg-paper px-4 py-2 text-xl font-black text-verdict shadow-[4px_4px_0_#202624]";
  stamp.textContent = event.toTier ? t("已落槌 · {0} {1}", tierById(event.toTier as TierId).emoji, t(tierById(event.toTier as TierId).label)) : t("已落槌");
  host.appendChild(stamp);
  try {
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const tween = gsap.fromTo(stamp, { opacity: 0, scale: 1.35 }, { opacity: 1, scale: 1, duration: 0.38, ease: "back.out(2)", motionPath: { path: [{ x: 0, y: 0 }, { x: verdict.direction === "up" ? 36 : -36, y: verdict.direction === "up" ? -44 : 44 }, { x: 0, y: 0 }], curviness: 1.4 }, onComplete: resolve });
      signal.addEventListener("abort", () => { tween.kill(); resolve(); }, { once: true });
    });
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const tween = gsap.to(stamp, { opacity: 0, delay: 0.65, duration: 0.32, onComplete: resolve });
      signal.addEventListener("abort", () => { tween.kill(); resolve(); }, { once: true });
    });
    if (signal.aborted || isMotionReduced()) return;
    if (verdict.shatter && markMajorEffect(event)) {
      const played = await getVoxelDrop()?.(host, event.toTier ?? 5, signal);
      if (!played && !signal.aborted && !isMotionReduced()) await playPixelShatter(host, event.toTier ?? 5, signal);
    }
  } catch {
    // Animation is best-effort; the confirmed vote is already rendered.
  } finally {
    stamp.remove();
  }
}

function markMajorEffect(event: VoteMotionEvent) {
  const key = `crous-major-motion:${event.dishId}:${event.toTier}`;
  if (window.sessionStorage.getItem(key)) return false;
  window.sessionStorage.setItem(key, "1");
  return true;
}

async function playPixelShatter(host: HTMLDivElement, tier: number, signal: AbortSignal) {
  const canvas = document.createElement("canvas");
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  canvas.className = "absolute inset-0 z-20 h-full w-full";
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio); host.appendChild(canvas);
  const color = ["#d88c86", "#d5b26f", "#d4ca78", "#c4bdb3", "#b6aaa4"][tier - 1] ?? "#b6aaa4";
  const particles = Array.from({ length: 42 }, (_, index) => ({ x: width * (0.25 + (index % 14) / 28), y: height * (0.76 + Math.floor(index / 14) * 0.035), vx: ((index % 7) - 3) * 10, vy: 35 + (index % 5) * 13, size: 4 + (index % 4) * 2 }));
  const started = performance.now();
  try {
    await new Promise<void>((resolve) => {
      let frame = 0;
      const draw = (now: number) => {
        if (signal.aborted || now - started >= 1200) return resolve();
        const elapsed = (now - started) / 1000;
        context.clearRect(0, 0, width, height); context.fillStyle = color;
        for (const particle of particles) context.fillRect(particle.x + particle.vx * elapsed, particle.y + particle.vy * elapsed + 150 * elapsed * elapsed, particle.size, particle.size);
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      signal.addEventListener("abort", () => { cancelAnimationFrame(frame); resolve(); }, { once: true });
    });
  } finally { canvas.remove(); }
}
