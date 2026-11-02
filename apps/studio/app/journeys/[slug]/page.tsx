import { notFound } from "next/navigation";
import { getRecord, latestRunForJourney, StoreError } from "@/lib/store";
import { Builder } from "@/components/Builder";

export const dynamic = "force-dynamic";

export default async function JourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const rec = await getRecord(slug);
    const run = await latestRunForJourney(slug);
    return <Builder initial={rec} aiRun={run ? { id: run.id, status: run.status, title: run.title } : null} />;
  } catch (e) {
    if (e instanceof StoreError) notFound();
    throw e;
  }
}
