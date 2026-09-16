import { localizedJson } from "@/lib/i18n/server";
import { AuthError, parseJsonRequest, requestEmailCode } from "@/lib/auth/email-auth";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await parseJsonRequest(request);
    return localizedJson({ data: await requestEmailCode(request, body.email), error: null, requestId }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof AuthError ? error.message : "验证码服务暂时不可用";
    return localizedJson({ data: null, error: message, requestId }, { status, headers: { "cache-control": "no-store" } });
  }
}
