import { localizedJson } from "@/lib/i18n/server";
import { GovernanceError, listNameSuggestions } from "@/lib/governance/naming-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const dishId = new URL(request.url).searchParams.get("dishId");
    if (!dishId) return localizedJson({ data: null, error: "菜品无效", requestId }, { status: 400 });
    return localizedJson({ data: await listNameSuggestions(dishId), error: null, requestId });
  } catch (error) { return localizedJson({ data: null, error: error instanceof GovernanceError ? error.message : "名称候选暂时不可用", requestId }, { status: error instanceof GovernanceError ? error.status : 500 }); }
}
