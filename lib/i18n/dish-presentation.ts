import type { Locale } from "./core";

type DishNames = { name: string; zh: string; canonicalNameFr?: string | null; canonicalNameEn?: string | null; canonicalNameZh?: string | null; originalDescription?: string; machineNameZh?: string | null; machineNameEn?: string | null };

/** Choose existing text, without translating it or changing its verification status. */
export function dishPresentation(dish: DishNames, locale: Locale) {
  const confirmedName = locale === "zh" ? dish.canonicalNameZh : dish.canonicalNameEn;
  const machine = locale === "zh" ? dish.machineNameZh : dish.machineNameEn;
  if (!confirmedName && machine) {
    const primary = locale === "zh" ? `${machine}（机译）` : `${machine} (machine translated)`;
    return { primary, secondary: dish.originalDescription ? `${locale === "zh" ? "原文：" : "Original: "}${dish.originalDescription}` : null, card: primary };
  }
  const primary = confirmedName || dish.originalDescription || dish.name;
  return { primary, secondary: null, card: primary };
}
