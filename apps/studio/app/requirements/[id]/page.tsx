import { RequirementEditor } from "@/components/RequirementEditor";

export const dynamic = "force-dynamic";
export default async function RequirementPage({ params }: { params: Promise<{ id: string }> }) { return <RequirementEditor id={(await params).id} />; }
