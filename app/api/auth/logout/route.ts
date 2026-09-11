import { AuthError, logoutEmailUser } from "@/lib/auth/email-auth";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const cookie = await logoutEmailUser(request);
    return Response.json({ data: { authenticated: false }, error: null, requestId }, { headers: { "set-cookie": cookie, "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return Response.json({ data: null, error: error instanceof AuthError ? error.message : "退出失败", requestId }, { status, headers: { "cache-control": "no-store" } });
  }
}
