"use client";
import { useT } from "@/lib/i18n/client";


import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { tierById, type TierId } from "./data";

export function VoteConfirmation({ target, onClose, onConfirm }: { target: TierId | null; onClose: () => void; onConfirm: (tier: TierId) => void }) {
  const t = useT();
  const tier = target ? tierById(target) : null;
  return <AlertDialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}><AlertDialogContent className="border-4 border-ink bg-paper">
    <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black">{t("这一锤下去，可就封卷了 🔨")}</AlertDialogTitle><AlertDialogDescription>{tier ? t("确定把它判为“{0} {1}”？法槌没有 Ctrl+Z，手滑也算供词。", tier.emoji, t(tier.label)) : ""}</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>{t("我再端详两眼")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (target) onConfirm(target); }} className="bg-ink">{t("确认落槌")}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
