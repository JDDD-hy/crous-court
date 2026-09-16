"use client";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { saveVenuePreference, type VenueOption } from "@/lib/venue-preference";
import { VenuePicker } from "./VenuePicker";
import { UploadFlow } from "./UploadFlow";

export function UploadVenueFlow({ options, initialIds }: { options: VenueOption[]; initialIds: string[] }) {
  const en = useLocale() === "en";
  const [ids, setIds] = useState(initialIds.filter(id => options.some(option => option.id === id && !option.legacy)));
  const [editing, setEditing] = useState(!ids.length);
  const selected = ids.flatMap(id => options.find(option => option.id === id) ?? []);
  function select(next: string[]) {
    saveVenuePreference(next); setIds(next); setEditing(false);
    const url = new URL(location.href); url.searchParams.delete("venue");
    next.forEach(id => url.searchParams.append("venue", id)); history.replaceState(null, "", url.pathname + url.search);
  }
  return <div className="space-y-7"><section data-venue-required={!selected.length ? "true" : "false"} className="border-b-2 border-ink/20 pb-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">{en ? "Crime scene" : "案发地点"}</h2>{selected.length > 0 && <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 px-3 underline">{en ? "Change venues" : "切换地点"}</button>}</div>
    {!selected.length && <p className="my-3 text-ink/65">{en ? "Choose nearby venues or search by name before uploading or viewing rankings." : "先确认附近餐厅，或按名称选择地点，再上传照片和查看榜单。"}</p>}
    {editing ? <VenuePicker options={options} onSelect={select} autoLocate={!selected.length} /> : <p className="mt-2">{en ? "Selected" : "已选地点"} · {selected.map(option => option.name).join(" / ")}</p>}
  </section>{selected.length > 0 && <UploadFlow venues={selected} />}</div>;
}
