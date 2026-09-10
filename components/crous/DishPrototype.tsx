"use client";

import Image from "next/image";
import { useState } from "react";
import { CalendarDays, CheckCircle2, History, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "./SiteHeader";
import { meals, tierById, tiers } from "./data";

const distributions = {
  "couscous-boulettes": [2, 5, 7, 3, 1],
  "lentilles-saucisse": [0, 1, 3, 6, 1],
  "mystery-dessert": [0, 0, 2, 1, 1],
} as const;

export function DishPrototype({ id }: { id: string }) {
  const dish = meals.find((meal) => meal.id === id) ?? meals[0];
  const distribution = distributions[dish.id as keyof typeof distributions] ?? distributions["couscous-boulettes"];
  const communityTier = tierById(dish.tier);
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr]">
      <section>
        <div className="relative rotate-[-1deg] border-[10px] border-paper bg-paper shadow-[7px_8px_0_#202624]"><Image src={dish.image} alt={`${dish.venue} 的${dish.zh}餐盘`} width={1206} height={678} priority className="h-[28rem] w-full object-cover" /><p className="p-3 font-mono text-sm">证物 A · {dish.date} · {dish.venue}</p></div>
        <div className="mt-8 grid grid-cols-2 gap-4"><Photo src={dish.image} label={`${dish.date} · 本次出餐`} /><EmptyPhoto label="较早 Serving · 暂无照片" /></div>
      </section>

      <section className="space-y-6">
        <div><p className="font-mono text-sm font-bold text-verdict">DISH · {dish.name.startsWith("神秘") ? "名称待取证" : "原型示例"}</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">{dish.name}</h1><p className="mt-2 text-xl text-ink/65">{dish.zh}</p></div>
        <div className="grid grid-cols-2 gap-3"><Verdict label="投稿者初判" value="😎 人上人" /><Verdict label="社区判决" value={`${communityTier.emoji} ${communityTier.label}`} strong /></div>
        <div className="flex flex-wrap gap-4 border-y-2 border-dashed border-ink/30 py-4 text-sm font-bold"><span className="flex items-center gap-1"><MapPin className="size-4" />1 家餐厅</span><span className="flex items-center gap-1"><CalendarDays className="size-4" />2 次原型出餐</span><span className="flex items-center gap-1"><History className="size-4" />{dish.votes} 张有效票</span></div>

        <Tabs defaultValue="votes">
          <TabsList className="h-12 w-full border-2 border-ink bg-paper p-1"><TabsTrigger value="votes" className="min-h-9 font-bold">票数分布</TabsTrigger><TabsTrigger value="history" className="min-h-9 font-bold">移动历史</TabsTrigger><TabsTrigger value="name" className="min-h-9 font-bold">群众认菜</TabsTrigger></TabsList>
          <TabsContent value="votes" className="mt-4 space-y-3">{tiers.map((tier, index) => <div key={tier.id} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3"><strong>{tier.emoji} {tier.label}</strong><div className="h-8 overflow-hidden rounded-sm border-2 border-ink bg-paper"><div className="h-full" style={{ width: `${dish.votes ? distribution[index] / dish.votes * 100 : 0}%`, backgroundColor: tier.color }} /></div><span className="font-mono font-bold">{distribution[index]}</span></div>)}</TabsContent>
          <TabsContent value="history" className="mt-4"><ol className="space-y-3 border-l-4 border-ink pl-5"><Event date={`${dish.date.slice(5)} · ${dish.votes}票`} text={`当前判决 → ${communityTier.label} ${communityTier.emoji}`} /><Event date={`${dish.date.slice(5)} · 1票`} text="投稿者初判：人上人 😎" /></ol></TabsContent>
          <TabsContent value="name" className="mt-4 border-2 border-ink bg-paper p-4"><h2 className="text-xl font-black">这盘到底是什么？</h2><p className="mt-1 text-sm text-ink/60">现场餐牌证据优先，外观猜测只算线索。</p>{submitted ? <p className="mt-5 flex items-center gap-2 font-bold text-verdict"><CheckCircle2 />候选已在本地模拟提交</p> : <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><input value={suggestion} onChange={(event) => setSuggestion(event.target.value)} required placeholder="法语名、中文名或别名" className="min-h-12 w-full rounded border-2 border-ink bg-paper px-3" /><select aria-label="证据类型" className="min-h-12 w-full rounded border-2 border-ink bg-paper px-3"><option>我当天也吃了</option><option>现场餐牌</option><option>根据外观猜测</option></select><Button className="min-h-11 bg-ink">提交名称候选</Button></form>}</TabsContent>
        </Tabs>
      </section>
    </div>
  </main></div>;
}

function Photo({ src, label }: { src: string; label: string }) { return <figure className="rotate-1 border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]"><Image src={src} alt={`不同日期的 CROUS 餐盘，${label}`} width={500} height={600} className="h-52 w-full object-cover" /><figcaption className="pt-2 font-mono text-xs">{label}</figcaption></figure>; }
function EmptyPhoto({ label }: { label: string }) { return <figure className="-rotate-1 border-8 border-paper bg-paper shadow-[4px_5px_0_#202624]"><div className="grid h-52 place-items-center bg-ink/10 text-center text-4xl" aria-label="暂无照片">🍽️<span className="block text-xs font-bold">本阶段不伪造第二张照片</span></div><figcaption className="pt-2 font-mono text-xs">{label}</figcaption></figure>; }
function Verdict({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`border-3 border-ink p-4 ${strong ? "rotate-1 bg-accent shadow-[4px_4px_0_#202624]" : "bg-paper"}`}><span className="block text-sm text-ink/55">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>; }
function Event({ date, text }: { date: string; text: string }) { return <li><span className="font-mono text-xs text-ink/55">{date}</span><strong className="block">{text}</strong></li>; }
