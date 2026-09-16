import { localizedJson } from "@/lib/i18n/server";
import { assertSameOrigin, AuthError, parseJsonRequest, requireAdminUser } from "@/lib/auth/email-auth";
import { GovernanceError } from "@/lib/governance/naming-service";
import { moderate } from "@/lib/governance/moderation-service";
import { after } from "next/server";
import { translateDishNames } from "@/lib/translation/translate-dishes";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const admin = await requireAdminUser();
    const input = await parseJsonRequest(request);
    const data = await moderate(admin.userId, input);
    if ((input.action === "verify_name" || input.action === "split_serving") && typeof data.dishId === "string") {
      const id = data.dishId;
      after(() => translateDishNames([{ id }]));
    }
    return localizedJson({ data, error: null, requestId });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return localizedJson({ data: null, error: known ? error.message : "管理操作失败", requestId }, { status: known ? error.status : 500 });
  }
}
