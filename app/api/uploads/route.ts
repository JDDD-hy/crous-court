import { assertSameOrigin, AuthError, getEmailUser } from "@/lib/auth/email-auth";
import { publishMeal, UploadInputError } from "@/lib/upload/upload-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertSameOrigin(request);
    const user = await getEmailUser();
    if (!user) return Response.json({ data: null, error: "请先通过邮箱验证码登录", requestId }, { status: 401 });
    const data = await publishMeal(await request.formData(), user.userId);
    return Response.json({ data, error: null, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ data: null, error: error.message, requestId }, { status: error.status });
    if (error instanceof UploadInputError) return Response.json({ data: null, error: error.message, requestId }, { status: 400 });
    console.error("upload failed", { requestId, error });
    return Response.json({ data: null, error: "投稿服务暂时不可用，请稍后重试", requestId }, { status: 500 });
  }
}
