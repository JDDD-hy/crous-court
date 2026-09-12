const STORAGE_KEY = "crous-motion-disabled";
export const MOTION_CHANGE_EVENT = "crous-motion-change";

export function isMotionReduced() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function isMotionEnabledByUser() {
  return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) !== "1";
}

export function setMotionEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "0" : "1");
  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}
