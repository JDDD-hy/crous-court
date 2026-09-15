"use client";
import { useT } from "@/lib/i18n/client";


import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmailOtpGate } from "./EmailOtpGate";

const className = "inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-paper shadow-[3px_3px_0_#c99a4b] transition-transform hover:-translate-y-0.5";

export function UploadNav({ authenticated, venueQuery = "" }: { authenticated: boolean; venueQuery?: string }) {
  const t = useT();
  if (authenticated) return <a href={`/upload${venueQuery}`} className={className}><Camera aria-hidden="true" className="size-4" />  {t("投稿")}</a>;
  return <Dialog><DialogTrigger asChild><Button data-login-required="upload" className={className}><Camera aria-hidden="true" className="size-4" />  {t("投稿")}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto border-4 border-ink bg-paper sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-black">{t("登录后投稿")}</DialogTitle><DialogDescription>{t("使用邮箱验证码验明身份后即可上传餐盘。")}</DialogDescription></DialogHeader><EmailOtpGate heading={t("投稿前先验明身份")} description={t("验证码会发送到你的邮箱；邮箱不会公开。")} redirectTo={`/upload${venueQuery}`} /></DialogContent>
  </Dialog>;
}
