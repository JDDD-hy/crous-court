"use client";

import { useEffect, useState } from "react";
import { isMotionEnabledByUser, MOTION_CHANGE_EVENT, setMotionEnabled } from "@/lib/motion-preference";

export function MotionPreferenceButton() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setEnabled(isMotionEnabledByUser());
    sync(); window.addEventListener(MOTION_CHANGE_EVENT, sync);
    return () => window.removeEventListener(MOTION_CHANGE_EVENT, sync);
  }, []);
  return <button type="button" aria-pressed={!enabled} onClick={() => { setMotionEnabled(!enabled); setEnabled(!enabled); }} className="min-h-11 rounded-full px-3 text-sm font-bold hover:bg-ink/5 focus-visible:outline-3 focus-visible:outline-offset-2" title={enabled ? "关闭夸张动效" : "开启夸张动效"}>动效 {enabled ? "开" : "关"}</button>;
}
