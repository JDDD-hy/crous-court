"use client";
import { useT } from "@/lib/i18n/client";


import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EmailLogoutButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex items-center"><Button type="button" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw new Error(); router.push("/"); router.refresh(); } catch { setError(t("退出失败")); } finally { setBusy(false); } }}>{busy ? t("退出中…") : t("退出")}</Button>{error && <span role="alert" className="ml-2 text-sm font-bold text-verdict">{t(error)}</span>}</div>;
}
