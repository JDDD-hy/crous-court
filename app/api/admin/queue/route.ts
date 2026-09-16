import { localizedJson } from "@/lib/i18n/server";
import { AuthError, requireAdminUser } from "@/lib/auth/email-auth";
import { getAdminQueue } from "@/lib/governance/moderation-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try { await requireAdminUser(); return localizedJson({ data: await getAdminQueue(), error: null, requestId }); }
  catch (error) { const known = error instanceof AuthError; return localizedJson({ data: null, error: known ? error.message : "管理队列不可用", requestId }, { status: known ? error.status : 500 }); }
}
