import { AuthError, assertSameOrigin, getEmailUser } from "@/lib/auth/email-auth";
import { identifyDish, IdentificationError } from "@/lib/ai/dish-identification";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    const file = (await request.formData()).get("image");
    if (!(file instanceof File)) throw new IdentificationError("请选择一张餐盘照片");
    return Response.json({ data: await identifyDish(file, user.userId), error: null, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = error instanceof AuthError || error instanceof IdentificationError;
    return Response.json({ data: null, error: known ? error.message : "AI 识菜暂时不可用", requestId }, { status: known ? error.status : 500, headers: { "cache-control": "no-store" } });
  }
}
