import { notFound } from "next/navigation";
import { getRecord, StoreError } from "@/lib/store";
import { ProofView } from "@/components/ProofView";

export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { draft } = await getRecord(slug);
    return <ProofView slug={slug} name={typeof draft.name === "string" ? draft.name : draft.name.en ?? slug} acceptance={draft.acceptance ?? []} scenarios={(draft.scenarios ?? []).map((s) => ({ id: s.id, name: s.name, covers: s.covers, persona: s.persona }))} />;
  } catch (e) {
    if (e instanceof StoreError) notFound();
    throw e;
  }
}
