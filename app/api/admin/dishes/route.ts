import { AuthError, requireAdminUser } from "@/lib/auth/email-auth";
import { GovernanceError } from "@/lib/governance/errors";
import { searchAdminDishes } from "@/lib/governance/admin-dish-search";
import { localizedJson } from "@/lib/i18n/server";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const headers = { "Cache-Control": "no-store" };
  try {
    await requireAdminUser();
    const params = new URL(request.url).searchParams;
    const data = await searchAdminDishes(params.get("q") ?? "", Number(params.get("offset") ?? 0));
    return localizedJson({ data, error: null, requestId }, { headers });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof GovernanceError;
    return localizedJson({ data: null, error: known ? error.message : "菜品查询失败", requestId }, { status: known ? error.status : 500, headers });
  }
}
