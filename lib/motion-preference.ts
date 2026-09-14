export function isMotionReduced() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canUseVoxelMotion() {
  return !isMotionReduced() && window.screen.width >= 1024
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
