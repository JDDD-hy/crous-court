import { HomePrototype } from "@/components/crous/HomePrototype";
import { listRankings } from "@/lib/ranking-service";

export default async function Home() {
  return <HomePrototype meals={await listRankings()} />;
}
