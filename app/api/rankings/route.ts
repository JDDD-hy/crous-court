import { listRankings } from "@/lib/ranking-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const category = new URL(request.url).searchParams.get("category");
    if (category !== null && category !== "main" && category !== "side") {
      return Response.json({ data: null, error: "category must be main or side", requestId }, { status: 400 });
    }
    return Response.json({ data: await listRankings(category ?? undefined), error: null, requestId });
  } catch {
    return Response.json({ data: null, error: "ranking data is unavailable", requestId }, { status: 500 });
  }
}
