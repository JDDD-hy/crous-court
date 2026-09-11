import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishMeal, UploadInputError } from "@/lib/upload/upload-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ data: null, error: "拒绝跨站投稿", requestId }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ data: null, error: "请先登录 ChatGPT 再投稿", requestId }, { status: 401 });
  try {
    const data = await publishMeal(await request.formData(), user.userId);
    return Response.json({ data, error: null, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadInputError) return Response.json({ data: null, error: error.message, requestId }, { status: 400 });
    console.error("upload failed", { requestId, error });
    return Response.json({ data: null, error: "投稿服务暂时不可用，请稍后重试", requestId }, { status: 500 });
  }
}
