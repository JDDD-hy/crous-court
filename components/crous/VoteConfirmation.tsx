"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { tierById, type TierId } from "./data";

export function VoteConfirmation({ target, onClose, onConfirm }: { target: TierId | null; onClose: () => void; onConfirm: (tier: TierId) => void }) {
  const tier = target ? tierById(target) : null;
  return <AlertDialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}><AlertDialogContent className="border-4 border-ink bg-paper">
    <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black">这一锤下去，可就封卷了 🔨</AlertDialogTitle><AlertDialogDescription>{tier ? `确定把它判为“${tier.emoji} ${tier.label}”？法槌没有 Ctrl+Z，手滑也算供词。` : ""}</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>我再端详两眼</AlertDialogCancel><AlertDialogAction onClick={() => { if (target) onConfirm(target); }} className="bg-ink">确认落槌</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
