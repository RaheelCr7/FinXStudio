import { notFound } from "next/navigation";
import { getRecord, StoreError } from "@/lib/store";
import { Builder } from "@/components/Builder";

export const dynamic = "force-dynamic";

export default async function JourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const rec = await getRecord(slug);
    return <Builder initial={rec} />;
  } catch (e) {
    if (e instanceof StoreError) notFound();
    throw e;
  }
}
