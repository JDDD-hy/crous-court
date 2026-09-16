"use client";
import { useT } from "@/lib/i18n/client";


import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useT();
  return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><p className="text-6xl" aria-hidden="true">🧯</p><h1 className="mt-5 text-4xl font-black">{t("D1 暂时没开庭")}</h1><p className="mt-3 text-ink/65">{t("读取失败，没有写入或丢失任何数据。")}</p><Button onClick={reset} className="mt-6 bg-ink">{t("重新读取")}</Button></div></main>;
}
