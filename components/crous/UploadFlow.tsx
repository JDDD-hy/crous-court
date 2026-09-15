"use client";
import { useT } from "@/lib/i18n/client";


/* eslint-disable @next/next/no-img-element -- local blob preview */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ExtraSideDishes, type ExtraSide } from "./ExtraSideDishes";
import { TierPicker } from "./TierPicker";
import { OptionalTier } from "./DishFields";
import { DishIdentityField } from "./DishIdentityField";
import { AiDishRecognition, type IdentificationResult } from "./AiDishRecognition";
import { DishRegionPreview } from "./DishRegionPreview";
import { sanitizePhoto } from "@/lib/upload/client-image";
import type { TierId } from "./data";
import { todayInParis } from "@/lib/calendar";
import type { VenueOption } from "@/lib/venue-preference";

type UploadResult = { mealId: string; photoId: string; caseNumber: string };

export function UploadFlow({ venues }: { venues: VenueOption[] }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [files, setFiles] = useState<{ canonical: File; thumbnail: File } | null>(null);
  const [tier, setTier] = useState<TierId>(3);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [mainName, setMainName] = useState("");
  const [sideOneName, setSideOneName] = useState("");
  const [sideTwoName, setSideTwoName] = useState("");
  const [extraSides, setExtraSides] = useState<ExtraSide[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [candidateSearchEnabled, setCandidateSearchEnabled] = useState(false);
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    setCandidateSearchEnabled(false);
    setIdentification(null);
    setError("");
    try {
      const cleaned = await sanitizePhoto(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(cleaned.canonical));
      setFiles(cleaned);
    } catch (cause) {
      setFiles(null);
      setError(cause instanceof Error ? cause.message : t("图片处理失败"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files) return setError(t("请先选择一张餐盘照片"));
    if (!rightsConfirmed) return setError(t("请确认照片发布权与无人脸信息"));
    setBusy(true);
    setError("");
    const body = new FormData(event.currentTarget);
    body.set("mainTier", String(tier));
    body.set("rightsConfirmed", "true");
    body.set("canonical", files.canonical);
    body.set("thumbnail", files.thumbnail);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = await response.json() as { data: UploadResult | null; error: string | null };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? t("投稿失败"));
      setResult(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("投稿失败，请稍后重试"));
    } finally {
      setBusy(false);
    }
  }

  if (result) return <Success result={result} onReset={() => { if (preview) URL.revokeObjectURL(preview); setExtraSides([]); setExtraOpen(false); setResult(null); setFiles(null); setPreview(null); formRef.current?.reset(); }} />;

  return <form ref={formRef} onSubmit={submit} onChangeCapture={() => setDirty(true)} data-language-busy={busy} data-language-draft={Boolean(dirty || files || mainName || sideOneName || sideTwoName || extraSides.length || tier !== 3 || rightsConfirmed)} className="space-y-7">
    <section className="border-4 border-ink bg-paper p-6 shadow-[7px_7px_0_#202624]">
      <p className="font-mono text-sm font-bold text-verdict">{t("1. 照片")}</p><h2 className="mt-2 text-2xl font-black">{t("上传整张餐盘")}</h2>
      <label className="mt-5 grid min-h-72 cursor-pointer place-items-center overflow-hidden rounded-lg border-4 border-dashed border-ink/45 bg-[#ded8c9] text-center focus-within:outline-3">{preview ? <img src={preview} alt={t("已清理元数据的餐盘预览")} className="h-72 w-full object-contain" /> : <span><ImagePlus className="mx-auto size-12" /><strong className="mt-3 block text-lg">{t("选择 JPG、PNG 或 HEIC")}</strong><small>{t("原图不离开浏览器；上传前会转为 JPEG 并移除 EXIF/GPS")}</small></span>}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label>
      <AiDishRecognition key={preview ?? "empty"} image={files?.thumbnail ?? null} imageUrl={preview} onResult={setIdentification} onApply={(main, sides) => { setMainName(main); setSideOneName(sides[0] ?? ""); setSideTwoName(sides[1] ?? ""); setExtraSides(sides.slice(2).map((name, index) => ({ slot: index + 3, name }))); setExtraOpen(sides.length > 2); setCandidateSearchEnabled(true); }} />
    </section>

    <section className="border-4 border-ink bg-paper p-6 shadow-[7px_7px_0_#202624]">
      <p className="font-mono text-sm font-bold text-verdict">{t("2. 菜品信息")}</p><h2 className="mt-2 text-2xl font-black">{t("同一天可以继续立案")}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="font-bold">{t("餐厅")}<NativeSelect key={venues.map(venue => venue.id).join(",")} name="venueId" required defaultValue="" className="mt-2 min-h-12 border-2 border-ink bg-paper text-base"><NativeSelectOption value="" disabled>{t("选择案发地点")}</NativeSelectOption>{venues.map(venue => <NativeSelectOption key={venue.id} value={venue.id}>{venue.name}</NativeSelectOption>)}</NativeSelect></label><label className="font-bold">{t("用餐日期")}<input name="eatenOn" type="date" required defaultValue={todayInParis()} max={todayInParis()} className="mt-2 min-h-12 w-full rounded-md border-2 border-ink bg-paper px-3" /></label></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-3"><DishIdentityField label={t("主食（可未知）")} name="mainName" category="main" value={mainName} onChange={setMainName} candidateSearchEnabled={candidateSearchEnabled} /><div><DishIdentityField label={t("小菜 1（可选）")} name="sideOneName" category="side" value={sideOneName} onChange={setSideOneName} candidateSearchEnabled={candidateSearchEnabled} /><DishRegionPreview imageUrl={preview} region={identification?.side_dishes[0]?.region ?? null} label={t("小菜 1")} /><OptionalTier name="sideOneTier" /></div><div><DishIdentityField label={t("小菜 2（可选）")} name="sideTwoName" category="side" value={sideTwoName} onChange={setSideTwoName} candidateSearchEnabled={candidateSearchEnabled} /><DishRegionPreview imageUrl={preview} region={identification?.side_dishes[1]?.region ?? null} label={t("小菜 2")} /><OptionalTier name="sideTwoTier" /></div></div>
      <ExtraSideDishes sides={extraSides} onChange={setExtraSides} open={extraOpen} onToggle={setExtraOpen} imageUrl={preview} identification={identification} candidateSearchEnabled={candidateSearchEnabled} />
      <p className="mt-4 border-l-4 border-accent pl-3 text-sm">{t("菜名可以先留空。原始文字会保留，后续识别或群众补名不会覆盖它。")}</p>
    </section>

    <section className="border-4 border-ink bg-paper p-6 shadow-[7px_7px_0_#202624]">
      <p className="font-mono text-sm font-bold text-verdict">{t("3. 初判")}</p><h2 className="mt-2 text-2xl font-black">{t("给主食一张真实票")}</h2><DishRegionPreview imageUrl={preview} region={identification?.staple?.region ?? null} label={t("主食")} /><div className="mt-3"><TierPicker value={tier} onChange={setTier} /></div>
      <label className="mt-7 flex items-start gap-3 border-2 border-ink/30 bg-[#ded8c9] p-4 text-sm"><Checkbox checked={rightsConfirmed} onCheckedChange={(value) => setRightsConfirmed(value === true)} className="mt-1 size-5" /><span>{t("我拥有或获准发布这张照片，并确认画面没有可识别人脸或其他私人信息。")}</span></label>
      {error && <p role="alert" className="mt-4 border-2 border-verdict bg-[#f4d9d4] p-3 font-bold text-verdict">{t(error)}</p>}
      <div className="mt-6 flex items-center justify-between"><span className="flex items-center gap-2 text-sm text-ink/60"><ShieldCheck className="size-4" />{t("登录后立即展示，可被举报后隐藏")}</span><Button type="submit" disabled={busy || !files || !rightsConfirmed} className="min-h-12 bg-ink px-6">{busy ? t("处理中…") : t("发布并立案")}</Button></div>
    </section>
  </form>;
}

function Success({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const t = useT();
  return <section className="grid min-h-[28rem] place-items-center border-4 border-ink bg-paper p-8 text-center shadow-[7px_7px_0_#202624]"><div><CheckCircle2 className="mx-auto size-16 text-praise" /><h2 className="mt-4 text-3xl font-black">{t("证物已入库")}</h2><p className="mt-2 text-lg">{t("案号")} <strong className="font-mono">{result.caseNumber}</strong></p><img src={`/api/photos/${result.photoId}`} alt={t("刚刚发布的餐盘")} className="mx-auto mt-5 max-h-64 rounded border-2 border-ink object-contain" /><Button className="mt-6 min-h-12 bg-ink" onClick={onReset}>{t("继续上传另一盘")}</Button></div></section>;
}
