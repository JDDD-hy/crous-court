import { getBindings } from "@/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, bucket } = getBindings();
  const photo = await db.prepare("SELECT p.canonical_key, p.media_type FROM photos p JOIN meals m ON m.id = p.meal_id WHERE p.id = ? AND m.status = 'active'").bind(id).first<{ canonical_key: string; media_type: string }>();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await bucket.get(photo.canonical_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": photo.media_type, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
