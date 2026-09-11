"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EmailLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="mb-4"><Button type="button" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw new Error(); router.refresh(); } catch { setError("退出失败，请稍后重试"); } finally { setBusy(false); } }}>{busy ? "退出中…" : "退出登录"}</Button>{error && <span role="alert" className="ml-3 text-sm font-bold text-verdict">{error}</span>}</div>;
}
