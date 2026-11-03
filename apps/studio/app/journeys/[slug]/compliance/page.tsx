import { notFound } from "next/navigation";
import { getRecord, StoreError } from "@/lib/store";
import { ComplianceView } from "@/components/ComplianceView";

export const dynamic = "force-dynamic";

export default async function CompliancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { draft } = await getRecord(slug);
    return <ComplianceView slug={slug} name={typeof draft.name === "string" ? draft.name : draft.name.en ?? slug} version={draft.version} />;
  } catch (e) {
    if (e instanceof StoreError) notFound();
    throw e;
  }
}
