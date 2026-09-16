
import { getT } from "@/lib/i18n/server";
/* eslint-disable @next/next/no-html-link-for-pages -- Vinext client Link crashes in this production build; recovery requires full navigation. */

export default async function NotFound() {
  const t = await getT();
  return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><p className="text-6xl" aria-hidden="true">🕵️</p><h1 className="mt-5 text-4xl font-black">{t("没有这宗菜案")}</h1><a href="/" className="mt-6 inline-block min-h-11 border-2 border-ink bg-paper px-5 py-2 font-black">{t("返回法庭")}</a></div></main>;
}
