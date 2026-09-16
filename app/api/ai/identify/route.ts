import { localizedJson } from "@/lib/i18n/server";
import { AuthError, assertSameOrigin, getEmailUser } from "@/lib/auth/email-auth";
import { identifyDish, IdentificationError } from "@/lib/ai/dish-identification";
import { BodyTooLargeError, InvalidBodyError, parseLimitedFormData } from "@/lib/http/read-limited-body";
import { ImageValidationError } from "@/lib/upload/image-validation";

const MAX_AI_BODY_BYTES = 9 * 1024 * 1024;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) throw new AuthError("请先使用邮箱验证码登录", 401);
    const file = (await parseLimitedFormData(request, MAX_AI_BODY_BYTES)).get("image");
    if (!(file instanceof File)) throw new IdentificationError("请选择一张餐盘照片");
    return localizedJson({ data: await identifyDish(file, user.userId), error: null, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      console.error(JSON.stringify({ event: "ai_image_rejected", requestId, code: error.code }));
      return localizedJson({ data: null, error: error.message, code: error.code, requestId }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    if (error instanceof BodyTooLargeError) return localizedJson({ data: null, error: "识别请求不能超过 9 MB", requestId }, { status: 413, headers: { "cache-control": "no-store" } });
    const known = error instanceof AuthError || error instanceof IdentificationError || error instanceof InvalidBodyError;
    return localizedJson({ data: null, error: known ? error.message : "AI 识菜暂时不可用", requestId }, { status: known ? error.status : 500, headers: { "cache-control": "no-store" } });
  }
}
