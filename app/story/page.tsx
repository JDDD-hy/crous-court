import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";

export const dynamic = "force-dynamic";

export default async function StoryPage() {
  const user = await getEmailUser();

  return (
    <>
      <SiteHeader authenticated={Boolean(user)} />
      <main className="mx-auto max-w-4xl px-6 py-20">
        <section className="border-2 border-ink bg-paper p-10 shadow-[8px_8px_0_#202624]">
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-verdict">Our Story</p>
          <h1 className="mt-4 text-4xl font-black">故事还在装盘 🍽️</h1>
          <p className="mt-4 text-lg text-ink/65">TODO：两位发起人的署名、缘起与开源共创说明。</p>
        </section>
      </main>
    </>
  );
}
