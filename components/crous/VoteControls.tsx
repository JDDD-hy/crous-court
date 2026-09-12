"use client";

import { useEffect, useState } from "react";
import { Check, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { reduceVoteState } from "@/lib/vote-state";
import type { VoteMotionEvent } from "@/lib/verdict-motion";
import { EmailOtpGate } from "./EmailOtpGate";
import { TierPicker } from "./TierPicker";
import { VoteConfirmation } from "./VoteConfirmation";
import { tierById, type TierId } from "./data";
import { VoteEffects } from "./VoteEffects";

type VoteResult = { dish: DishSummary; myVote: Tier };

export function VoteControls({ dish, authenticated, myVote, onChange, onInteractionChange }: { dish: DishSummary; authenticated: boolean; myVote: Tier | null; onChange: (dish: DishSummary) => void; onInteractionChange?: (active: boolean) => void }) {
  const categoryLabel = dish.category === "main" ? "主食" : "小菜";
  const displayedTier = (dish.tier ?? dish.initialTier ?? 3) as TierId;
  const [selectedTier, setSelectedTier] = useState<TierId>(displayedTier);
  const [voteState, setVoteState] = useState({ dish, myVote, error: "" });
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<TierId | null>(null);
  const [motionEvent, setMotionEvent] = useState<VoteMotionEvent | null>(null);
  const interacting = open || loginOpen || confirmation !== null || pending;
  useEffect(() => onInteractionChange?.(interacting), [interacting, onInteractionChange]);

  function propose(target: TierId) {
    if (!authenticated) setLoginOpen(true);
    else if (!voteState.myVote) setConfirmation(target);
  }

  async function submit(target: TierId) {
    if (voteState.myVote) return;
    const snapshot = voteState;
    const optimistic = reduceVoteState(voteState, { type: "optimistic", target });
    setVoteState(optimistic); onChange(optimistic.dish); setPending(true); setConfirmation(null);
    try {
      const response = await fetch(`/api/dishes/${encodeURIComponent(dish.id)}/vote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetTier: target }) });
      const payload = await response.json() as { data: VoteResult | null; error: string | null };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "判决提交失败");
      const confirmed = reduceVoteState(optimistic, { type: "confirmed", ...payload.data });
      setMotionEvent({ id: crypto.randomUUID(), dishId: dish.id, fromTier: snapshot.dish.tier, toTier: confirmed.dish.tier });
      setVoteState(confirmed); onChange(confirmed.dish);
    } catch (cause) {
      const rolledBack = reduceVoteState(optimistic, { type: "rollback", snapshot, error: cause instanceof Error ? cause.message : "判决提交失败" });
      setVoteState(rolledBack); onChange(rolledBack.dish);
    } finally { setPending(false); }
  }

  const locked = pending || Boolean(voteState.myVote);
  return <div className="relative">
    <div className="grid grid-cols-2 gap-3">
      <Button disabled={locked} onClick={() => propose(displayedTier)} className="min-h-14 border-2 border-ink bg-praise font-black text-ink shadow-[4px_4px_0_#202624] hover:bg-praise/90"><Check />{pending ? "提交中…" : voteState.myVote ? "已经落槌" : "判得对"}</Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={locked} variant="outline" className="min-h-14 border-2 border-ink bg-paper font-black shadow-[4px_4px_0_#c7655f]"><Scale />{categoryLabel} · 我有异议</Button></DialogTrigger>
        <DialogContent className="border-4 border-ink bg-paper sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-black">{categoryLabel}异议庭</DialogTitle><DialogDescription>只调整这份{categoryLabel}的判决；每道菜只能判一次。</DialogDescription></DialogHeader><TierPicker value={selectedTier} onChange={setSelectedTier} />
          {selectedTier === displayedTier && <p role="status" className="border-2 border-accent bg-[#f4e4b8] p-3 text-sm font-bold">友情提示：这档和“判得对”一模一样。绕了一圈，还是原判 😌</p>}
          <Button disabled={pending} onClick={() => { setOpen(false); propose(selectedTier); }} className="min-h-12 bg-ink font-black">落槌，就它了</Button>
        </DialogContent></Dialog>
    </div>
    <p aria-live="polite" className="mt-4 min-h-6 text-center text-sm font-bold text-verdict">{pending ? "正在记录判决…" : voteState.myVote ? `你的判决：${tierById(voteState.myVote).emoji} ${tierById(voteState.myVote).label} · 已封卷` : authenticated ? "尚未判决；提交后不可修改" : "登录后即可提交判决"}</p>
    {voteState.error && <p role="alert" className="mt-2 border-2 border-verdict bg-[#f4d9d4] p-3 font-bold text-verdict">{voteState.error}</p>}
    <VoteConfirmation target={confirmation} onClose={() => setConfirmation(null)} onConfirm={(tier) => void submit(tier)} />
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}><DialogContent className="max-h-[90vh] overflow-y-auto border-4 border-ink bg-paper sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-black">登录后提交判决</DialogTitle><DialogDescription>使用邮箱验证码登录。登录后请再次点击提交。</DialogDescription></DialogHeader><EmailOtpGate heading="验明身份" description="验证码会发送到你的邮箱；邮箱不会公开。" /></DialogContent></Dialog>
    <VoteEffects event={motionEvent} />
  </div>;
}
