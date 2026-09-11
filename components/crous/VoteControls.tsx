"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { reduceVoteState } from "@/lib/vote-state";
import { EmailOtpGate } from "./EmailOtpGate";
import { TierPicker } from "./TierPicker";
import { tierById, type TierId } from "./data";

type VoteResult = { dish: DishSummary; myVote: Tier };

export function VoteControls({ dish, authenticated, myVote, onChange }: {
  dish: DishSummary;
  authenticated: boolean;
  myVote: Tier | null;
  onChange: (dish: DishSummary) => void;
}) {
  const router = useRouter();
  const displayedTier = (dish.tier ?? dish.initialTier ?? 3) as TierId;
  const [selectedTier, setSelectedTier] = useState<TierId>(displayedTier);
  const [voteState, setVoteState] = useState({ dish, myVote, error: "" });
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  async function submit(next: TierId) {
    if (!authenticated) { setLoginOpen(true); return; }
    const snapshot = voteState;
    const optimistic = reduceVoteState(voteState, { type: "optimistic", target: next });
    setVoteState(optimistic); onChange(optimistic.dish); setPending(true); setOpen(false);
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dish.id)}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetTier: next }),
      });
      const payload = await response.json() as { data: VoteResult | null; error: string | null };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "判决提交失败");
      const confirmed = reduceVoteState(optimistic, { type: "confirmed", ...payload.data });
      setVoteState(confirmed); onChange(confirmed.dish);
      router.refresh();
    } catch (cause) {
      const rolledBack = reduceVoteState(optimistic, { type: "rollback", snapshot, error: cause instanceof Error ? cause.message : "判决提交失败" });
      setVoteState(rolledBack); onChange(rolledBack.dish);
    } finally { setPending(false); }
  }

  return <div>
    <div className="grid grid-cols-2 gap-3">
      <Button disabled={pending} onClick={() => void submit(displayedTier)} className="min-h-14 border-2 border-ink bg-praise font-black text-ink shadow-[4px_4px_0_#202624] hover:bg-praise/90"><Check />{pending ? "提交中…" : "判得对"}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button disabled={pending} variant="outline" className="min-h-14 border-2 border-ink bg-paper font-black shadow-[4px_4px_0_#c7655f]"><Scale />我有异议</Button></DialogTrigger>
        <DialogContent className="border-4 border-ink bg-paper sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black">请提交你的判决</DialogTitle><DialogDescription>选择你认为正确的等级。</DialogDescription></DialogHeader>
          <TierPicker value={selectedTier} onChange={setSelectedTier} />
          <Button disabled={pending} onClick={() => void submit(selectedTier)} className="min-h-12 bg-ink font-black">落槌，就它了</Button>
        </DialogContent>
      </Dialog>
    </div>
    <p aria-live="polite" className="mt-4 min-h-6 text-center text-sm font-bold text-verdict">{pending ? "正在记录判决…" : voteState.myVote ? `你的判决：${tierById(voteState.myVote).emoji} ${tierById(voteState.myVote).label}` : authenticated ? "尚未判决" : "登录后即可提交判决"}</p>
    {voteState.error && <p role="alert" className="mt-2 border-2 border-verdict bg-[#f4d9d4] p-3 font-bold text-verdict">{voteState.error}</p>}
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-4 border-ink bg-paper sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-2xl font-black">登录后提交判决</DialogTitle><DialogDescription>使用邮箱验证码登录。登录后请再次点击提交。</DialogDescription></DialogHeader>
        <EmailOtpGate heading="验明身份" description="验证码会发送到你的邮箱；邮箱不会公开。" />
      </DialogContent>
    </Dialog>
  </div>;
}
