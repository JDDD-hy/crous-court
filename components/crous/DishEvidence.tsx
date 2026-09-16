"use client";
import { useLocale, useT } from "@/lib/i18n/client";
import { dishPresentation } from "@/lib/i18n/dish-presentation";


import Image from "next/image";
import type { DishDetail } from "@/lib/dish-types";

export function DishEvidence({ dish }: { dish: DishDetail }) {
  const t = useT();
  const locale = useLocale();
  const labels = dishPresentation(dish, locale);
  const originalServings = [...new Map(dish.servings.filter(serving => serving.originalDescription).map(serving => [serving.id, serving])).values()];
  const otherPhotos = dish.servings.filter((serving) => serving.image && serving.image !== dish.image);
  const category = dish.category === "main" ? t("主食") : t("小菜");
  return <section><div className="relative rotate-[-1deg] border-[10px] border-paper bg-paper shadow-[7px_8px_0_#202624]"><Image src={dish.image} alt={t("{0} 的{1}{2}餐盘", dish.venue, labels.card, category)} width={1206} height={678} priority className="h-[28rem] w-full bg-ink/10 object-contain" draggable={false} /><p className="p-3 font-mono text-sm">{t("证物 A ·")} {category} · {dish.date} · {dish.venue}</p></div>
    <h2 className="mt-8 text-xl font-black">{t("嫌疑人行踪")}</h2>{otherPhotos.length ? <details className="mt-3 border-2 border-ink/30 bg-paper/45 p-3"><summary className="flex min-h-11 cursor-pointer items-center font-bold focus-visible:outline-3 focus-visible:outline-offset-2">{t("展开")} {otherPhotos.length}  {t("次其他行踪")}</summary><div className="mt-4 grid grid-cols-2 gap-4">{otherPhotos.map((serving, index) => <Photo key={`${serving.id}:${serving.image}`} src={serving.image!} label={`${serving.date} · ${serving.venue}${serving.originalDescription ? t(" · 投稿者称“{0}”", serving.originalDescription) : ""}`} index={index} />)}</div></details> : <div className="mt-3"><EmptyPhoto /></div>}
    {originalServings.length > 0 && <details className="mt-4 border-2 border-ink/30 bg-paper/45 p-3"><summary className="min-h-11 cursor-pointer py-2 font-bold">{t("投稿原文")}</summary><ul className="space-y-2 text-sm">{originalServings.map(serving => <li key={serving.id}>{serving.date} · {serving.venue}{t(" · 投稿者称“{0}”", serving.originalDescription)}</li>)}</ul></details>}
  </section>;
}

function Photo({ src, label, index }: { src: string; label: string; index: number }) {
  const t = useT(); return <figure className={`${index % 2 ? "rotate-1" : "-rotate-1"} border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]`}><Image src={src} alt={t("不同日期的 CROUS 餐盘，{0}", label)} width={500} height={600} className="h-52 w-full object-cover" draggable={false} /><figcaption className="pt-2 font-mono text-xs">{label}</figcaption></figure>; }
function EmptyPhoto() {
  const t = useT(); return <figure className="-rotate-1 border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]"><div className="grid h-52 place-items-center bg-ink/10 text-center text-4xl" aria-label={t("暂无照片")}>🍽️<span className="block text-xs font-bold">{t("暂无其他观测照片")}</span></div><figcaption className="pt-2 font-mono text-xs">{t("较早观测 · 暂无照片")}</figcaption></figure>; }
