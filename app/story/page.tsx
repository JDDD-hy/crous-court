
import { getT } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";

export const dynamic = "force-dynamic";

export default async function StoryPage({ searchParams }: { searchParams: Promise<{ venue?: string | string[] }> }) {
  const t = await getT();
  const user = await getEmailUser();
  const venue = (await searchParams).venue;
  const query = new URLSearchParams();
  for (const id of venue === undefined ? [] : Array.isArray(venue) ? venue : [venue]) query.append("venue", id);
  const venueQuery = query.size ? `?${query}` : "";

  return (
    <>
      <SiteHeader authenticated={Boolean(user)} />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <article className="border-2 border-ink bg-paper px-6 py-10 shadow-[8px_8px_0_#202624] sm:px-12 sm:py-14 lg:px-20">
          <header className="border-b-2 border-dashed border-ink/20 pb-10 sm:pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-sm font-bold uppercase tracking-widest">
              <p className="text-verdict">Our Story</p>
              <span className="border border-ink/30 px-3 py-1 text-ink/60">{t("卷宗 Nº 000")}</span>
            </div>
            <h1 className="mt-6 text-4xl leading-tight font-black sm:text-5xl">{t("故事还在装盘")} <span aria-hidden="true">🍽️</span></h1>
            <p className="mt-5 text-lg leading-relaxed text-ink/70">{t("关于一张餐盘，以及每个吃过它的人。")}</p>
          </header>

          <section aria-labelledby="story-origin" className="border-b-2 border-dashed border-ink/20 py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">{t("01 / 立案缘由")}</p>
            <h2 id="story-origin" className="text-2xl font-black sm:text-3xl">{t("这一盘，你来判。")}</h2>
            <div className="mt-6 space-y-4 text-lg leading-loose text-ink/80">
              <p>{t("小青椒最先提出了一个点子：给 CROUS 的菜品做一个“从夯到拉”的排行榜。")}</p>
              <p>{t("JDDD 不想让这个点子只停留在两个人之间，于是把它做成了网站，让更多在法国吃 CROUS 的中国留学生一起参与。CROUS法庭就这样开始了。")}</p>
              <p>{t("一张餐盘照片、一票自己的判断，都是参与的方式。主食归主食，小菜归小菜；遇到叫不出名字的菜，也可以先留下照片，交给群众一起认。")}</p>
              <p>{t("先从帕莱索开始，之后争取做大做强，在更多CROUS开庭——说不定能到全法呢（bushi，开玩笑的")}</p>
            </div>
            <blockquote className="mt-8 border-l-4 border-verdict bg-ink/5 px-5 py-4 text-lg font-bold leading-relaxed">{t("调侃的是菜品，认真的是每个人的用餐体验。")}</blockquote>
          </section>

          <section aria-labelledby="story-people" className="border-b-2 border-dashed border-ink/20 py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">{t("02 / 法庭班底")}</p>
            <h2 id="story-people" className="text-2xl font-black sm:text-3xl">{t("卷宗，由大家一起写。")}</h2>
            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <div className="border-2 border-ink bg-white/40 p-6 shadow-[4px_4px_0_#202624]">
                <span aria-hidden="true" className="text-3xl">🕶</span>
                <h3 className="mt-4 text-xl font-black">JDDD</h3>
                <p className="mt-2 text-base font-bold text-verdict">{t("法庭网管")}</p>
                <p className="mt-5 border-t border-dashed border-ink/25 pt-4 font-mono text-sm text-ink/60">{t("网站开发 / JDDD")}</p>
              </div>
              <div className="border-2 border-ink bg-white/40 p-6 shadow-[4px_4px_0_#202624]">
                <span aria-hidden="true" className="text-3xl">🫑</span>
                <h3 className="mt-4 text-xl font-black">{t("小青椒")}</h3>
                <p className="mt-2 text-base font-bold text-verdict">{t("味觉证人")}</p>
                <p className="mt-5 border-t border-dashed border-ink/25 pt-4 font-mono text-sm text-ink/60">{t("创意提出 / 小青椒")}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="story-community" className="py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">{t("03 / 一起共创")}</p>
            <h2 id="story-community" className="text-2xl font-black sm:text-3xl">{t("下一个卷宗，等你开场。")}</h2>
            <div className="mt-6 border-2 border-ink bg-ink/5 p-6 sm:p-8">
              <p className="text-lg leading-loose text-ink/80">{t("可以提交一张餐盘照片，也可以去榜单看看大家的判决。发现菜名不对，留下你的线索；发现不合适的内容，使用举报入口。")}</p>
              <a href={`/rankings${venueQuery}`} className="mt-6 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-paper px-6 py-3 text-base font-black shadow-[4px_4px_0_#202624] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">{t("去长期榜单旁听")} <span aria-hidden="true" className="ml-3">↗</span></a>
            </div>
          </section>
          <section aria-labelledby="story-contact" className="border-t-2 border-dashed border-ink/20 py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">{t("04 / 还有高手？")}</p>
            <h2 id="story-contact" className="text-2xl font-black sm:text-3xl">{t("来，一起把法庭整大点。")}</h2>
            <p className="mt-6 text-lg leading-loose text-ink/80">{t("我们只是抛砖引玉！有更离谱的点子？欢迎来信")}</p>
            <a href="mailto:xedocjade@agent.qq.com" className="mt-6 inline-flex min-h-11 max-w-full items-center border-2 border-ink bg-paper px-4 py-3 text-base font-bold shadow-[4px_4px_0_#202624] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:px-6"><span className="break-all">xedocjade@agent.qq.com</span></a>
            <div className="mt-4">
              <a href="https://github.com/JDDD-hy/crous-court" className="inline-flex min-h-11 max-w-full items-center gap-3 text-base font-bold underline underline-offset-4 hover:text-verdict focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-6 shrink-0"><path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.628-5.479 5.925.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                <span className="min-w-0 break-all">github.com/JDDD-hy/crous-court</span>
              </a>
            </div>
          </section>
          <footer className="border-t-2 border-dashed border-ink/20 pt-8 text-center text-base leading-relaxed text-ink/65">{t("故事仍在装盘，判决交给你们。")}<p className="mt-2 text-sm">{t("CROUS法庭 · 学生社区，非 CROUS 官方网站")}</p></footer>
        </article>
      </main>
    </>
  );
}
