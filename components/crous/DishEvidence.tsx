import Image from "next/image";
import type { DishDetail } from "@/lib/dish-types";

export function DishEvidence({ dish }: { dish: DishDetail }) {
  const otherPhotos = dish.servings.filter((serving) => serving.image && serving.image !== dish.image);
  const category = dish.category === "main" ? "主食" : "小菜";
  return <section><div className="relative rotate-[-1deg] border-[10px] border-paper bg-paper shadow-[7px_8px_0_#202624]"><Image src={dish.image} alt={`${dish.venue} 的${dish.zh}${category}餐盘`} width={1206} height={678} priority className="h-[28rem] w-full bg-ink/10 object-contain" draggable={false} /><p className="p-3 font-mono text-sm">证物 A · {category} · {dish.date} · {dish.venue}</p></div>
    <h2 className="mt-8 text-xl font-black">嫌疑人行踪</h2>{otherPhotos.length ? <details className="mt-3 border-2 border-ink/30 bg-paper/45 p-3"><summary className="flex min-h-11 cursor-pointer items-center font-bold focus-visible:outline-3 focus-visible:outline-offset-2">展开 {otherPhotos.length} 次其他行踪</summary><div className="mt-4 grid grid-cols-2 gap-4">{otherPhotos.map((serving, index) => <Photo key={`${serving.id}:${serving.image}`} src={serving.image!} label={`${serving.date} · ${serving.venue}${serving.originalDescription ? ` · 投稿者称“${serving.originalDescription}”` : ""}`} index={index} />)}</div></details> : <div className="mt-3"><EmptyPhoto /></div>}
  </section>;
}

function Photo({ src, label, index }: { src: string; label: string; index: number }) { return <figure className={`${index % 2 ? "rotate-1" : "-rotate-1"} border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]`}><Image src={src} alt={`不同日期的 CROUS 餐盘，${label}`} width={500} height={600} className="h-52 w-full object-cover" draggable={false} /><figcaption className="pt-2 font-mono text-xs">{label}</figcaption></figure>; }
function EmptyPhoto() { return <figure className="-rotate-1 border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]"><div className="grid h-52 place-items-center bg-ink/10 text-center text-4xl" aria-label="暂无照片">🍽️<span className="block text-xs font-bold">暂无其他观测照片</span></div><figcaption className="pt-2 font-mono text-xs">较早观测 · 暂无照片</figcaption></figure>; }
