import { notFound } from "next/navigation";
import { getRecord, StoreError } from "@/lib/store";
import { AnalyticsView } from "@/components/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { draft } = await getRecord(slug);
    return <AnalyticsView slug={slug} name={typeof draft.name === "string" ? draft.name : draft.name.en ?? slug} />;
  } catch (e) {
    if (e instanceof StoreError) notFound();
    throw e;
  }
}
