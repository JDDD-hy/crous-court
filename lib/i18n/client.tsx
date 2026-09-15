"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { localeCookie, translator, type Locale } from "./core";

const LocaleContext = createContext<Locale>("zh");
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
export function useT() { const locale = useLocale(); return useMemo(() => translator(locale), [locale]); }

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useT();
  return <button type="button" lang={locale === "zh" ? "en" : "zh-CN"} aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
    className="min-h-11 shrink-0 rounded-full border border-ink/30 px-3 py-2 text-sm font-bold hover:bg-ink/5"
    onClick={() => {
      if (document.querySelector('[data-language-busy="true"]')) { window.alert(t("操作仍在进行，请完成后再切换语言。")); return; }
      if (document.querySelector('[data-language-draft="true"]') && !window.confirm(t("切换语言会重新加载页面，未提交的内容将丢失。继续切换？"))) return;
      document.cookie = `${localeCookie}=${locale === "zh" ? "en" : "zh"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      window.location.reload();
    }}>{locale === "zh" ? "EN" : "中文"}</button>;
}
