import { DishPrototype } from "@/components/crous/DishPrototype";

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DishPrototype id={id} />;
}
