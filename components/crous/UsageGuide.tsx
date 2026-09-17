"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/client";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const storageKey = "crous-usage-guide-seen";
let dismissedThisPage = false;

export function UsageGuide() {
  const en = useLocale() === "en";
  const [open, setOpen] = useState(false);
  const chooseVenue = useRef(false);
  useEffect(() => {
    if (!["/", "/rankings", "/story"].includes(location.pathname) || dismissedThisPage) return;
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === "1"; } catch { /* Browsing still works without storage. */ }
    // Read the browser-only preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen(true);
  }, []);
  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) {
      dismissedThisPage = true;
      try { localStorage.setItem(storageKey, "1"); } catch { /* Keep dismissal for this page if storage is blocked. */ }
    }
  }
  const steps = en ? [
    ["Choose your venues", "Open Crime scene in the top bar, then select Within 1 km and allow location access. We recommend Use all nearby venues to see dishes from every listed venue within 1 km.", "You can also select + Search by name and enter a venue or town. No location permission needed."],
    ["Browse dishes and cast your vote", "In court shows dishes from today and yesterday; Rankings includes older dishes. Open a dish to see its photos and sightings.", "Agree with the rating, or choose another tier. Sign in by email code to vote. Each account gets one vote per dish; confirmed votes cannot be changed."],
    ["Share your meal", "Select Submit, sign in, and choose the one venue where you ate. Upload your tray photo, check the date, then name and rate the main and any sides before submitting.", "Unsure of a dish's name? Leave it unknown. Your initial rating counts as your vote."],
  ] : [
    ["先选案发地点", "点击顶栏「案发地点」→「附近 1 km」，允许定位后，推荐点击「使用以上附近餐厅」，一起查看周围 1 km 内已收录餐厅的菜品。", "也可以点「+ 自己输入」，搜索餐厅名称或城市后选择；不开放定位也能用。"],
    ["看菜，再来一票", "「今日开庭」看今天和昨天的菜，「长期榜单」看包含更早记录的排行。点开菜品，可以看照片和其他「行踪」。", "点击「判得对」赞同当前等级，或点「我有异议」选择自己的等级。投票时用邮箱验证码登录；同一账号每道菜只能投一次，确认后不能修改。"],
    ["把你的餐盘也端上来", "点击「投稿」，登录后选定实际就餐的一家餐厅，上传餐盘照片、核对日期，再填写主食和小菜的名称与初始等级，确认提交。", "不知道菜名也能投稿，保留未知即可；初评会计入你的投票，无需再投一次。"],
  ];
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><button type="button" className="flex min-h-11 items-center gap-1.5 px-3 hover:bg-ink/5"><BookOpen aria-hidden="true" className="size-4" />{en ? "How to use" : "使用说明"}</button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto rounded-none border-3 border-ink bg-paper p-5 shadow-[6px_6px_0_#202624] sm:max-w-2xl sm:p-7" onCloseAutoFocus={event => {
      if (!chooseVenue.current) return;
      chooseVenue.current = false;
      const menu = document.querySelector<HTMLDetailsElement>("[data-venue-menu]");
      if (menu) { event.preventDefault(); menu.open = true; menu.querySelector("summary")?.focus(); }
      else {
        // Match the existing full-navigation flow for server-rendered venue scope.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.assign("/");
      }
    }}>
      <DialogHeader className="pr-10 text-left">
        <p className="font-mono text-sm font-bold tracking-widest text-verdict">{en ? "JUROR'S GUIDE" : "陪审员入门"}</p>
        <DialogTitle className="text-3xl font-black leading-tight">{en ? "Your first visit to CROUS Court" : "第一次来，这样开庭"}</DialogTitle>
        <DialogDescription className="text-base text-ink/70">{en ? "Browse without an account. Sign in only when you vote or submit." : "看菜不用登录；投票、投稿时再用邮箱验证码登录。"}</DialogDescription>
      </DialogHeader>
      <DialogClose asChild><button type="button" aria-label={en ? "Close guide" : "关闭使用说明"} className="absolute right-3 top-3 grid size-11 place-items-center hover:bg-ink/10"><X aria-hidden="true" className="size-5" /></button></DialogClose>
      <ol className="divide-y-2 divide-ink/15">
        {steps.map(([title, body, note], index) => <li key={title} className="flex gap-3 py-4">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-accent font-mono font-black">{index + 1}</span>
          <div><h3 className="text-xl font-black">{title}</h3><p className="mt-2 leading-relaxed">{body}</p><p className="mt-2 text-sm leading-relaxed text-ink/70">{note}</p></div>
        </li>)}
      </ol>
      <div className="flex flex-wrap gap-3 border-t-2 border-ink pt-4">
        <button type="button" onClick={() => { chooseVenue.current = true; changeOpen(false); }} className="min-h-11 border-2 border-ink bg-ink px-5 py-2 font-bold text-paper">{en ? "Choose venues" : "去选案发地点"}</button>
        <DialogClose asChild><button type="button" className="min-h-11 px-3 underline">{en ? "Got it" : "知道了，先看看"}</button></DialogClose>
        <p className="w-full text-sm text-ink/65">{en ? "Reopen this guide anytime from How to use in the top bar." : "以后可从顶栏「使用说明」再次查看。"}</p>
      </div>
    </DialogContent>
  </Dialog>;
}
