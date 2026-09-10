import { getDishDetail } from "@/lib/ranking-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const dish = await getDishDetail((await params).id);
    if (!dish) return Response.json({ data: null, error: "dish not found", requestId }, { status: 404 });
    return Response.json({ data: dish, error: null, requestId });
  } catch {
    return Response.json({ data: null, error: "dish data is unavailable", requestId }, { status: 500 });
  }
}
