import type { Locale } from "./core";

type DishNames = { name: string; zh: string; canonicalNameFr?: string | null; canonicalNameEn?: string | null; canonicalNameZh?: string | null; originalDescription?: string; machineNameZh?: string | null };

/** Choose existing text, without translating it or changing its verification status. */
export function dishPresentation(dish: DishNames, locale: Locale) {
  const confirmedName = locale === "zh" ? dish.canonicalNameZh : dish.canonicalNameEn;
  if (!confirmedName && locale === "zh" && dish.machineNameZh) {
    const primary = `${dish.machineNameZh}（机译）`;
    return { primary, secondary: dish.originalDescription ? `原文：${dish.originalDescription}` : null, card: primary };
  }
  const primary = confirmedName || dish.originalDescription || dish.name;
  return { primary, secondary: null, card: primary };
}
