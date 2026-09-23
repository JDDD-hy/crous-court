export function middleware() {
  return new Response("升级维护中，请稍后再试。 / Maintenance in progress. Please try again shortly.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store", "retry-after": "60", "x-crous-maintenance": "ready" },
  });
}
export const config = { matcher: ["/:path*"] };
