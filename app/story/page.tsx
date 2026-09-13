import { SiteHeader } from "@/components/crous/SiteHeader";
import { getEmailUser } from "@/lib/auth/email-auth";

export const dynamic = "force-dynamic";

export default async function StoryPage() {
  const user = await getEmailUser();

  return (
    <>
      <SiteHeader authenticated={Boolean(user)} />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <article className="border-2 border-ink bg-paper px-6 py-10 shadow-[8px_8px_0_#202624] sm:px-12 sm:py-14 lg:px-20">
          <header className="border-b-2 border-dashed border-ink/20 pb-10 sm:pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-sm font-bold uppercase tracking-widest">
              <p className="text-verdict">Our Story</p>
              <span className="border border-ink/30 px-3 py-1 text-ink/60">卷宗 Nº 000</span>
            </div>
            <h1 className="mt-6 text-4xl leading-tight font-black sm:text-5xl">故事还在装盘 <span aria-hidden="true">🍽️</span></h1>
            <p className="mt-5 text-lg leading-relaxed text-ink/70">关于一张餐盘，以及每个吃过它的人。</p>
          </header>

          <section aria-labelledby="story-origin" className="border-b-2 border-dashed border-ink/20 py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">01 / 立案缘由</p>
            <h2 id="story-origin" className="text-2xl font-black sm:text-3xl">这一盘，你来判。</h2>
            <div className="mt-6 space-y-4 text-lg leading-loose text-ink/80">
              <p>CROUS法庭是一个面向帕莱索学生的食堂菜品社区。在这里，一张真实餐盘照片，就是一份新的卷宗。</p>
              <p>主食归主食，小菜归小菜。从“夯”到“拉爆了”，每个人都可以给出自己的判断。遇到叫不出名字的菜，也可以先留下照片，交给群众一起认。</p>
              <p>同一道菜，不同的日期、不同的餐盘，都值得被记录。判决由大家的投票形成，照片则保留每一次相遇。</p>
              <p>先从帕莱索开庭，之后争取做大做强——开玩笑的，但扩展到全法这件事，我们还真想试试。</p>
            </div>
            <blockquote className="mt-8 border-l-4 border-verdict bg-ink/5 px-5 py-4 text-lg font-bold leading-relaxed">调侃的是菜品，认真的是每个人的用餐体验。</blockquote>
          </section>

          <section aria-labelledby="story-people" className="border-b-2 border-dashed border-ink/20 py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">02 / 法庭班底</p>
            <h2 id="story-people" className="text-2xl font-black sm:text-3xl">卷宗，由大家一起写。</h2>
            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <div className="border-2 border-ink bg-white/40 p-6 shadow-[4px_4px_0_#202624]">
                <span aria-hidden="true" className="text-3xl">💻</span>
                <h3 className="mt-4 text-xl font-black">JDDD</h3>
                <p className="mt-2 text-base font-bold text-verdict">法庭网管</p>
                <p className="mt-5 border-t border-dashed border-ink/25 pt-4 font-mono text-sm text-ink/60">发起人 / JDDD</p>
              </div>
              <div className="border-2 border-ink bg-white/40 p-6 shadow-[4px_4px_0_#202624]">
                <span aria-hidden="true" className="text-3xl">🌶️</span>
                <h3 className="mt-4 text-xl font-black">小青椒</h3>
                <p className="mt-2 text-base font-bold text-verdict">味觉证人</p>
                <p className="mt-5 border-t border-dashed border-ink/25 pt-4 font-mono text-sm text-ink/60">发起人 / 小青椒</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="story-community" className="py-10 sm:py-12">
            <p className="mb-3 font-mono text-sm font-bold tracking-widest text-verdict">03 / 一起共创</p>
            <h2 id="story-community" className="text-2xl font-black sm:text-3xl">下一个卷宗，等你开场。</h2>
            <div className="mt-6 border-2 border-ink bg-ink/5 p-6 sm:p-8">
              <p className="text-lg leading-loose text-ink/80">可以提交一张餐盘照片，也可以去榜单看看大家的判决。发现菜名不对，留下你的线索；发现不合适的内容，使用举报入口。</p>
              <a href="/rankings" className="mt-6 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-paper px-6 py-3 text-base font-black shadow-[4px_4px_0_#202624] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">去长期榜单旁听 <span aria-hidden="true" className="ml-3">↗</span></a>
            </div>
          </section>
          <footer className="border-t-2 border-dashed border-ink/20 pt-8 text-center text-base leading-relaxed text-ink/65">故事仍在装盘，判决交给你们。<p className="mt-2 text-sm">CROUS法庭 · 学生社区，非 CROUS 官方网站</p></footer>
        </article>
      </main>
    </>
  );
}
