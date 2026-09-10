import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><div><p className="text-6xl" aria-hidden="true">🕵️</p><h1 className="mt-5 text-4xl font-black">没有这宗菜案</h1><Link href="/" className="mt-6 inline-block min-h-11 border-2 border-ink bg-paper px-5 py-2 font-black">返回法庭</Link></div></main>;
}
