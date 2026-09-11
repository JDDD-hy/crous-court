import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { UploadFlow } from "@/components/crous/UploadFlow";
import { SiteHeader } from "@/components/crous/SiteHeader";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await getChatGPTUser();
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-8"><header className="mb-7"><p className="font-mono text-sm font-bold text-verdict">证物提交处 · Phase 3</p><h1 className="mt-2 text-4xl font-black">端上来，开审。</h1><p className="mt-2 text-ink/65">每张餐盘独立立案；同一天、同一食堂可以连续投稿。</p></header>{user ? <UploadFlow /> : <section className="border-4 border-ink bg-paper p-8 shadow-[7px_7px_0_#202624]"><h2 className="text-2xl font-black">投稿前先验明身份</h2><p className="mt-3 text-ink/70">浏览榜单不需要登录；上传会记录稳定的站内用户编号，不公开邮箱。</p><a href={chatGPTSignInPath("/upload")} target="_top" className="mt-6 inline-flex min-h-12 items-center rounded-md bg-ink px-5 font-bold text-paper">使用 ChatGPT 登录</a></section>}</main></div>;
}
