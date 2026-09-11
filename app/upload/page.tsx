import { getEmailUser } from "@/lib/auth/email-auth";
import { EmailOtpGate } from "@/components/crous/EmailOtpGate";
import { EmailLogoutButton } from "@/components/crous/EmailLogoutButton";
import { UploadFlow } from "@/components/crous/UploadFlow";
import { SiteHeader } from "@/components/crous/SiteHeader";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await getEmailUser();
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-8"><header className="mb-7"><p className="font-mono text-sm font-bold text-verdict">证物提交处 · Phase 3</p><h1 className="mt-2 text-4xl font-black">端上来，开审。</h1><p className="mt-2 text-ink/65">每张餐盘独立立案；同一天、同一食堂可以连续投稿。</p></header>{user ? <><EmailLogoutButton /><UploadFlow /></> : <EmailOtpGate />}</main></div>;
}
