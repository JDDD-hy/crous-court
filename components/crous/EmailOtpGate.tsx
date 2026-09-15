"use client";
import { useT } from "@/lib/i18n/client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Challenge = { challengeId: string; devCode: string | null };

export function EmailOtpGate({ heading = "投稿前先验明身份", description = "验证码会发送到你的邮箱；邮箱不会公开。", redirectTo }: { heading?: string; description?: string; redirectTo?: string } = {}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true); setError("");
    try {
      const data = await post<Challenge>("/api/auth/email/request", { email });
      setChallenge(data); setCooldown(60); setCode("");
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true); setError("");
    try {
      await post("/api/auth/email/verify", { email, challengeId: challenge.challengeId, code });
      if (redirectTo) window.location.assign(redirectTo);
      else router.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <section data-language-busy={busy} data-language-draft={Boolean(email || challenge || code)} className="border-4 border-ink bg-paper p-8 shadow-[7px_7px_0_#202624]">
    <p className="font-mono text-sm font-bold text-verdict">{t("身份核验")}</p><h2 className="mt-2 text-2xl font-black">{t(heading)}</h2>
    {!challenge ? <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }} className="mt-6 max-w-lg"><label htmlFor="login-email" className="font-bold">{t("邮箱地址")}</label><Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error email-help" : "email-help"} className="mt-2 min-h-12 border-2 border-ink bg-paper text-base" /><p id="email-help" className="mt-2 text-sm text-ink/65">{t(description)}</p><Button disabled={busy} className="mt-5 min-h-12 bg-ink px-6">{busy ? t("发送中…") : t("发送验证码")}</Button></form> : <form onSubmit={verify} className="mt-6"><p className="text-ink/70">{t("输入发送到")} <strong>{maskEmail(email)}</strong>  {t("的六位验证码。")}</p><InputOTP autoFocus maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={code} onChange={(value) => { setCode(value); setError(""); }} containerClassName="mt-5" aria-label={t("六位邮箱验证码")} aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error" : undefined}><InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="size-12 border-2 border-ink text-lg" />)}</InputOTPGroup></InputOTP>{challenge.devCode && <p className="mt-3 rounded border-2 border-accent bg-[#efe2ac] p-3 font-mono text-sm" aria-live="polite">{t("本地验收验证码：")}<strong>{challenge.devCode}</strong></p>}<div className="mt-5 flex flex-wrap gap-3"><Button disabled={busy || code.length !== 6} className="min-h-12 bg-ink px-6">{busy ? t("核验中…") : t("验证并继续")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setChallenge(null); setCode(""); setError(""); }} className="min-h-12 border-2 border-ink">{t("更换邮箱")}</Button><Button type="button" variant="ghost" disabled={busy || cooldown > 0} onClick={() => void sendCode()} className="min-h-12">{cooldown ? t("{0} 秒后可重发", cooldown) : t("重新发送")}</Button></div></form>}
    {error && <p id="auth-error" role="alert" className="mt-5 border-2 border-verdict bg-[#f4d9d4] p-3 font-bold text-verdict">{t(error)}</p>}
  </section>;
}

async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as { data: T | null; error: string | null };
  if (!response.ok || payload.data === null) throw new Error(payload.error ?? "请求失败");
  return payload.data;
}
function maskEmail(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, 2)}***@${domain}`; }
function message(cause: unknown) { return cause instanceof Error ? cause.message : "请求失败，请稍后再试"; }
