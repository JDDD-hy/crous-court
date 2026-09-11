import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export const temporaryNames = [
  "神秘黄色主食",
  "疑似鸡肉配谷物",
  "不知道是什么但挺夯",
  "Sauce marron non identifiée",
  "Plat mystère n°42",
];

export function DishNameField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return <label className="block font-bold">{label}<input name={name} list="temporary-names" required={required} maxLength={80} placeholder="不知道可留空或写临时名称" className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3 font-normal" /></label>;
}

export function OptionalTier({ name }: { name: string }) {
  return <NativeSelect name={name} className="mt-2 min-h-12 border-2 border-ink bg-paper text-base"><NativeSelectOption value="">不初判，暂不加入</NativeSelectOption><NativeSelectOption value="1">夯 🐮</NativeSelectOption><NativeSelectOption value="2">顶级 👑</NativeSelectOption><NativeSelectOption value="3">人上人 😎</NativeSelectOption><NativeSelectOption value="4">NPC 🤖</NativeSelectOption><NativeSelectOption value="5">拉爆了 💩</NativeSelectOption></NativeSelect>;
}

export function TemporaryNameOptions() {
  return <datalist id="temporary-names">{temporaryNames.map((name) => <option value={name} key={name} />)}</datalist>;
}
