"use client";

import { useLocale } from "@/lib/i18n/client";

export function DishName({ labels }: { labels: { primary: string; secondary: string | null } }) {
  const en = useLocale() === "en";
  return <>{labels.primary}{labels.secondary && <span className="dish-translation">{labels.secondary} <small>({en ? "Title above is machine translated" : "上文由机器翻译"})</small></span>}</>;
}
