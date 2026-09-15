import { localizedJson } from "@/lib/i18n/server";
import { assertSameOrigin, AuthError, parseJsonRequest, requireAdminUser } from "@/lib/auth/email-auth";
import { GovernanceError } from "@/lib/governance/naming-service";
import { moderate } from "@/lib/governance/moderation-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const admin = await requireAdminUser();
    return localizedJson({ data: await moderate(admin.userId, await parseJsonRequest(request)), error: null, requestId });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return localizedJson({ data: null, error: known ? error.message : "管理操作失败", requestId }, { status: known ? error.status : 500 });
  }
}
