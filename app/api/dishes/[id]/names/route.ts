import { localizedJson } from "@/lib/i18n/server";
import { AuthError, assertSameOrigin, getEmailUser, parseJsonRequest } from "@/lib/auth/email-auth";
import { GovernanceError, suggestName } from "@/lib/governance/naming-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    const data = await suggestName((await params).id, user.userId, await parseJsonRequest(request));
    return localizedJson({ data, error: null, requestId }, { status: 201 });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return localizedJson({ data: null, error: known ? error.message : "补名提交失败", requestId }, { status: known ? error.status : 500 });
  }
}
