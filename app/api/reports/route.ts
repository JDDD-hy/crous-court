import { AuthError, assertSameOrigin, getEmailUser, parseJsonRequest } from "@/lib/auth/email-auth";
import { GovernanceError } from "@/lib/governance/naming-service";
import { createReport } from "@/lib/governance/moderation-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    return Response.json({ data: await createReport(user.userId, await parseJsonRequest(request)), error: null, requestId }, { status: 201 });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return Response.json({ data: null, error: known ? error.message : "举报提交失败", requestId }, { status: known ? error.status : 500 });
  }
}
