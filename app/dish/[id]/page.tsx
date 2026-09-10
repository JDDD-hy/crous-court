import { DishPrototype } from "@/components/crous/DishPrototype";
import { getDishDetail } from "@/lib/ranking-service";
import { notFound } from "next/navigation";

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dish = await getDishDetail(id);
  if (!dish) notFound();
  return <DishPrototype dish={dish} />;
}
