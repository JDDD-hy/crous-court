import { SiteHeader } from "@/components/crous/SiteHeader";
import { VenueFinder } from "@/components/crous/VenueFinder";
import { getLocale } from "@/lib/i18n/server";
import directory from "@/data/versailles-venues.json";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><VenueFinder venues={directory.venues} locale={await getLocale()} /></div>;
}
