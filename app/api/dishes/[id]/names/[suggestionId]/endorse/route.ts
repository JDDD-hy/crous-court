import { localizedJson } from "@/lib/i18n/server";
import { AuthError, assertSameOrigin, getEmailUser } from "@/lib/auth/email-auth";
import { endorseName, GovernanceError } from "@/lib/governance/naming-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; suggestionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    const { id, suggestionId } = await params;
    return localizedJson({ data: await endorseName(id, suggestionId, user.userId), error: null, requestId });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return localizedJson({ data: null, error: known ? error.message : "支持名称失败", requestId }, { status: known ? error.status : 500 });
  }
}
