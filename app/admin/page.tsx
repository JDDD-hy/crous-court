
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { AdminQueue } from "@/components/crous/AdminQueue";
import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser, isAdminUser } from "@/lib/auth/email-auth";
import { getAdminQueue } from "@/lib/governance/moderation-service";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const t = await getT();
  const user = await getEmailUser();
  if (!user || !await isAdminUser(user.userId)) notFound();
  return <div className="min-h-screen bg-background"><SiteHeader authenticated /><main className="mx-auto max-w-5xl px-6 py-8"><p className="font-mono text-sm font-bold text-verdict">{t("书记员工作台")}</p><h1 className="mt-2 text-4xl font-black">{t("复核与归档")}</h1><div className="mt-7"><AdminQueue initialQueue={await getAdminQueue()} /></div></main></div>;
}
