import { cookies } from "next/headers";
import { localeCookie, parseLocale, translator } from "./core";

export async function getLocale() { return parseLocale((await cookies()).get(localeCookie)?.value); }
export async function getT() { return translator(await getLocale()); }

/** Translate only application errors, never arbitrary response data. */
export async function localizedJson<T extends { error: string | null }>(body: T, init?: ResponseInit) {
  const t = await getT();
  const headers = new Headers(init?.headers);
  headers.append("Vary", "Cookie");
  return Response.json({ ...body, error: body.error ? t(body.error) : null }, { ...init, headers });
}
