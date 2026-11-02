import { listJourneys } from "@/lib/store";
import { JourneyList } from "@/components/JourneyList";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [journeys, sp] = await Promise.all([listJourneys(), searchParams]);
  return <JourneyList journeys={journeys} defaultNew={sp.new === "1"} />;
}
