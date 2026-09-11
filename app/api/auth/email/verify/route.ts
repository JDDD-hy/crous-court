import { AuthError, parseJsonRequest, verifyEmailCode } from "@/lib/auth/email-auth";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await parseJsonRequest(request);
    const result = await verifyEmailCode(request, body.email, body.challengeId, body.code);
    return Response.json({ data: { authenticated: true }, error: null, requestId }, { headers: { "set-cookie": result.cookie, "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof AuthError ? error.message : "登录服务暂时不可用";
    return Response.json({ data: null, error: message, requestId }, { status, headers: { "cache-control": "no-store" } });
  }
}
