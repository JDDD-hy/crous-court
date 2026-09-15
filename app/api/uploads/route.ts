import { localizedJson } from "@/lib/i18n/server";
import { after } from "next/server";
import { translateDishNames } from "@/lib/translation/translate-dishes";
import { assertSameOrigin, AuthError, getEmailUser } from "@/lib/auth/email-auth";
import { BodyTooLargeError, InvalidBodyError, parseLimitedFormData } from "@/lib/http/read-limited-body";
import { publishMeal, UploadInputError } from "@/lib/upload/upload-service";

const MAX_UPLOAD_BODY_BYTES = 17 * 1024 * 1024;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) return localizedJson({ data: null, error: "请先通过邮箱验证码登录", requestId }, { status: 401 });
    const form = await parseLimitedFormData(request, MAX_UPLOAD_BODY_BYTES);
    const { translationCandidates, ...data } = await publishMeal(form, user.userId);
    after(() => translateDishNames(translationCandidates));
    return localizedJson({ data, error: null, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return localizedJson({ data: null, error: error.message, requestId }, { status: error.status });
    if (error instanceof BodyTooLargeError) return localizedJson({ data: null, error: "投稿请求不能超过 17 MB", requestId }, { status: 413 });
    if (error instanceof InvalidBodyError) return localizedJson({ data: null, error: error.message, requestId }, { status: error.status });
    if (error instanceof UploadInputError) return localizedJson({ data: null, error: error.message, requestId }, { status: 400 });
    console.error("upload failed", { requestId, error });
    return localizedJson({ data: null, error: "投稿服务暂时不可用，请稍后重试", requestId }, { status: 500 });
  }
}
