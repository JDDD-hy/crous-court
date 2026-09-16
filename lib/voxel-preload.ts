import { canUseVoxelMotion } from "./motion-preference.ts";

type VoxelModule = typeof import("../components/crous/voxel-drop.ts");
let loading: Promise<void> | undefined;
let ready: VoxelModule | undefined;

// Cold/failed loads keep the existing 2D effect; voting never waits for WASM.
export function getVoxelDrop() {
  return canUseVoxelMotion() ? ready?.playVoxelDrop : undefined;
}

export function preloadVoxelDrop() {
  if (!canUseVoxelMotion()) return () => {};
  let cancelled = false;
  let idle: number | undefined;
  let timer: number | undefined;
  const load = () => {
    if (cancelled || !canUseVoxelMotion()) return;
    loading ??= import("../components/crous/voxel-drop.ts")
      .then(async (module) => {
        if (!canUseVoxelMotion()) return;
        await module.initializeVoxelPhysics();
        ready = module;
      }).catch(() => { /* Optional effect; retain 2D fallback for this page. */ });
  };
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(load);
    else timer = window.setTimeout(load, 1500);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
