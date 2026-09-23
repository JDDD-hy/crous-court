export function ResultPages({ path, query, page, total, size, en, parameter = "page" }: { path: string; query: string; page: number; total: number; size: number; en: boolean; parameter?: string }) {
  if (total <= size) return null;
  function href(next: number) { const params = new URLSearchParams(query); params.set(parameter,String(next)); return `${path}?${params}`; }
  return <nav aria-label={en ? "Result pages" : "结果分页"} className="mx-auto my-8 flex max-w-3xl items-center justify-between gap-4 px-4 text-base">
    {page > 1 ? <a className="inline-flex min-h-11 items-center underline" href={href(page-1)}>{en ? "Previous" : "上一页"}</a> : <span />}
    <span>{page} / {Math.ceil(total/size)}</span>
    {page*size < total ? <a className="inline-flex min-h-11 items-center underline" href={href(page+1)}>{en ? "Next" : "下一页"}</a> : <span />}
  </nav>;
}
