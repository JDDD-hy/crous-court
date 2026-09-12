"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function ReportDialog({ dishId, mealId, authenticated }: { dishId: string; mealId: string; authenticated: boolean }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("wrong_dish"); const [details, setDetails] = useState(""); const [message, setMessage] = useState("");
  async function submit() {
    const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dishId, mealId, reason, details }) });
    const payload = await response.json() as { error: string | null };
    if (!response.ok) return setMessage(payload.error ?? "举报提交失败");
    setMessage("书记员已收件，等待复核。");
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm">举报这份档案</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>提交复核</DialogTitle></DialogHeader>{authenticated ? <div className="space-y-3"><NativeSelect value={reason} onChange={(event) => setReason(event.target.value)}><NativeSelectOption value="wrong_dish">菜品关联错了</NativeSelectOption><NativeSelectOption value="privacy">包含隐私信息</NativeSelectOption><NativeSelectOption value="not_food">不是餐盘内容</NativeSelectOption><NativeSelectOption value="abuse">不当内容</NativeSelectOption><NativeSelectOption value="other">其他</NativeSelectOption></NativeSelect><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} placeholder="补充说明（可选）" className="min-h-28 w-full rounded border-2 border-ink bg-paper p-3" /><Button onClick={submit}>提交举报</Button>{message && <p role="status">{message}</p>}</div> : <p>请先通过邮箱验证码登录。</p>}</DialogContent></Dialog>;
}
