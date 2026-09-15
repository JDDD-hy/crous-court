"use client";
import { useT } from "@/lib/i18n/client";


import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function DishNameField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  const t = useT();
  return <label className="block font-bold">{label}<input name={name} required={required} maxLength={80} placeholder={t("先留空，后续再识别")} className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3 font-normal" /></label>;
}

export function OptionalTier({ name }: { name: string }) {
  const t = useT();
  return <NativeSelect name={name} className="mt-2 min-h-12 border-2 border-ink bg-paper text-base"><NativeSelectOption value="">{t("不初判，暂不加入")}</NativeSelectOption><NativeSelectOption value="1">{t("夯 🐮")}</NativeSelectOption><NativeSelectOption value="2">{t("顶级 👑")}</NativeSelectOption><NativeSelectOption value="3">{t("人上人 😎")}</NativeSelectOption><NativeSelectOption value="4">NPC 🤖</NativeSelectOption><NativeSelectOption value="5">{t("拉爆了 💩")}</NativeSelectOption></NativeSelect>;
}
