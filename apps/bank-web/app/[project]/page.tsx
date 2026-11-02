import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }: { params: Promise<{ project: string }> }) {
  redirect(`/${(await params).project}/login`);
}
