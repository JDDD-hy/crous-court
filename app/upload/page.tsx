
import { getT } from "@/lib/i18n/server";
import { getEmailUser } from "@/lib/auth/email-auth";
import { EmailOtpGate } from "@/components/crous/EmailOtpGate";
import { UploadVenueFlow } from "@/components/crous/UploadVenueFlow";
import { getVenueScope } from "@/lib/venue-scope";
import { SiteHeader } from "@/components/crous/SiteHeader";

export const dynamic = "force-dynamic";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ venue?: string | string[] }> }) {
  const t = await getT();
  const user = await getEmailUser();
  const scope = user ? await getVenueScope((await searchParams).venue, true) : null;
  return <div className="min-h-screen bg-background"><SiteHeader authenticated={Boolean(user)} /><main className="mx-auto max-w-4xl px-6 py-8"><header className="mb-7"><p className="font-mono text-sm font-bold text-verdict">{t("证物提交处")}</p><h1 className="mt-2 text-4xl font-black">{t("端上来，开审。")}</h1><p className="mt-2 text-ink/65">{t("每张餐盘独立立案；同一天、同一食堂可以连续投稿。")}</p></header>{user ? <UploadVenueFlow options={scope!.options} initialIds={scope!.ids ?? []} /> : <EmailOtpGate />}</main></div>;
}
