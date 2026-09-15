
import { getT } from "@/lib/i18n/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getT();
  return <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-[1.2fr_.8fr] items-center gap-6 px-6" aria-label={t("正在读取 D1 排名")}><Skeleton className="h-[68vh] rounded-[1.4rem] bg-ink/15" /><div className="space-y-5 border-4 border-ink bg-paper p-7"><Skeleton className="h-5 w-36 bg-ink/15" /><Skeleton className="h-24 w-full bg-ink/15" /><Skeleton className="h-16 w-full bg-ink/15" /><Skeleton className="h-14 w-full bg-ink/15" /></div></main>;
}
