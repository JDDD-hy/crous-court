import { localizedJson } from "@/lib/i18n/server";
import { AuthError, assertSameOrigin, getEmailUser, parseJsonRequest } from "@/lib/auth/email-auth";
import { submitVote, VoteError } from "@/lib/vote-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    const body = await parseJsonRequest(request);
    const data = await submitVote((await params).id, user.userId, body.targetTier);
    return localizedJson({ data, error: null, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof VoteError;
    return localizedJson({ data: error instanceof VoteError ? error.currentVote ?? null : null, error: known ? error.message : "判决提交失败", requestId }, {
      status: known ? error.status : 500,
      headers: { "cache-control": "no-store" },
    });
  }
}
