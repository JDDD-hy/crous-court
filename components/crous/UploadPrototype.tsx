"use client";

/* eslint-disable @next/next/no-img-element -- local blob previews are not Next Image sources */

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "./SiteHeader";
import { TierPicker } from "./TierPicker";
import type { TierId } from "./data";

const duplicateOptions = ["同一次出餐", "同菜但不同日期", "完全不同"];

export function UploadPrototype() {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [venue, setVenue] = useState("escoffier");
  const [mainName, setMainName] = useState("");
  const [sideOne, setSideOne] = useState("");
  const [sideTwo, setSideTwo] = useState("");
  const [tier, setTier] = useState<TierId>(3);
  const [duplicate, setDuplicate] = useState("完全不同");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(file?: File) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-7"><p className="font-mono text-sm font-bold text-verdict">证物提交处 · Phase 1 本地演示</p><h1 className="mt-2 text-4xl font-black">端上来，开审。</h1><p className="mt-2 text-ink/65">照片只在当前浏览器预览，不会上传或保存。</p></header>
      <ol className="mb-7 grid grid-cols-4 gap-2" aria-label="投稿进度">{["照片", "菜品信息", "判决", "查重"].map((label, index) => <li key={label} className={`border-b-4 pb-2 text-sm font-bold ${step >= index + 1 ? "border-verdict text-ink" : "border-ink/20 text-ink/45"}`}>{index + 1}. {label}</li>)}</ol>

      <section className="min-h-[31rem] border-4 border-ink bg-paper p-5 shadow-[7px_7px_0_#202624] sm:p-7">
        {step === 1 && <div><h2 className="text-2xl font-black">上传整张餐盘</h2><label className="mt-5 grid min-h-80 cursor-pointer place-items-center overflow-hidden rounded-lg border-4 border-dashed border-ink/45 bg-[#ded8c9] text-center focus-within:outline-3">{preview ? <img src={preview} alt="本地选择的餐盘预览" className="h-80 w-full object-contain" /> : <span><ImagePlus className="mx-auto size-12" /><strong className="mt-3 block text-lg">选择一张照片</strong><small>JPG / PNG · 本阶段不发送到服务器</small></span>}<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><button type="button" onClick={() => setPreview("/meals/couscous.jpg")} className="mt-4 min-h-11 font-bold underline">没有现成文件？使用示例餐盘</button></div>}

        {step === 2 && <div className="space-y-6"><h2 className="text-2xl font-black">这顿饭在哪发生？</h2><label className="block font-bold">餐厅<Select value={venue} onValueChange={setVenue}><SelectTrigger className="mt-2 min-h-12 w-full border-2 border-ink bg-paper"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="escoffier">🏫 Télécom 附近 — Escoffier</SelectItem><SelectItem value="experimental">🏠 All Suites 附近 — L’Expérimental</SelectItem></SelectContent></Select></label><label className="block font-bold">日期<input type="date" defaultValue="2026-09-10" className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3" /></label><div className="grid gap-4 sm:grid-cols-3"><ItemField label="主食（可未知）" placeholder="知道就写，不知道留空" value={mainName} onChange={setMainName} /><ItemField label="小菜 1（可选）" placeholder="例如：胡萝卜" value={sideOne} onChange={setSideOne} /><ItemField label="小菜 2（可选）" placeholder="最多两份" value={sideTwo} onChange={setSideTwo} /></div><p className="border-l-4 border-accent pl-3 text-sm">这是什么？知道就写，不知道交给群众。空名称将显示为“神秘菜品 #编号”。</p></div>}

        {step === 3 && <div><h2 className="text-2xl font-black">给主食一个初判</h2><p className="mb-5 mt-2 text-ink/65">这是你的第一张真实投票；Phase 1 仅模拟。</p><TierPicker value={tier} onChange={setTier} /><div className="mt-8 flex items-center gap-4 border-2 border-ink/25 bg-[#ded8c9] p-4"><img src={preview ?? "/meals/couscous.jpg"} alt="刚才选择的餐盘预览" className="h-20 w-28 rounded object-cover" /><div><strong className="block">{mainName || "神秘主食 #预览"}</strong><span className="text-sm">{venue === "escoffier" ? "Escoffier" : "L’Expérimental"} · {[sideOne, sideTwo].filter(Boolean).join("、") || "无小菜名"}</span></div></div></div>}

        {step === 4 && <div><h2 className="text-2xl font-black">好像在哪见过这盘</h2><p className="mt-2 text-ink/65">疑似记录只提示，不会自动合并。</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Image src="/meals/couscous.jpg" alt="疑似重复的肉丸古斯古斯" width={500} height={300} className="h-52 w-full rounded object-cover" /><div className="border-2 border-ink p-4"><p className="font-mono text-xs">候选 1 / 1</p><h3 className="mt-2 text-xl font-black">Couscous aux boulettes</h3><p className="text-sm">Escoffier · 2026-09-10</p><div className="mt-4 space-y-2">{duplicateOptions.map((option) => <button key={option} type="button" onClick={() => setDuplicate(option)} aria-pressed={duplicate === option} className="min-h-11 w-full rounded border-2 border-ink px-3 text-left font-bold aria-pressed:bg-accent">{duplicate === option ? "✓ " : ""}{option}</button>)}</div></div></div></div>}

        {step === 5 && <div className="grid min-h-[25rem] place-items-center text-center"><div><CheckCircle2 className="mx-auto size-16 text-praise" /><h2 className="mt-4 text-3xl font-black">证物已模拟入库</h2><p className="mt-2 text-ink/65">没有文件被上传，也没有创建真实记录。</p><Button className="mt-6 min-h-12 bg-ink" onClick={() => setStep(1)}>再演示一次</Button></div></div>}
      </section>

      {step <= 4 && <div className="mt-7 flex items-center justify-between"><Button variant="outline" disabled={step === 1} onClick={() => setStep((value) => value - 1)} className="min-h-11 border-2 border-ink bg-paper"><ArrowLeft />上一步</Button><span className="hidden items-center gap-2 text-sm text-ink/60 sm:flex"><ShieldCheck className="size-4" />无网络写入</span><Button disabled={step === 1 && !preview} onClick={() => setStep((value) => value + 1)} className="min-h-11 bg-ink">{step === 4 ? "模拟发布" : "下一步"}<ArrowRight /></Button></div>}
    </main></div>
  );
}

function ItemField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <label className="font-bold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3 font-normal" /></label>;
}
