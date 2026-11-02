import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/inter";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "@finx/renderer-web/src/styles/renderer.css";
import "../globals.css";
import "../bankworkx.css";
import { AppProvider } from "@/components/AppProvider";
import { getProject } from "@/lib/projects";

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const p = getProject((await params).project);
  return { title: p ? `${p.def.name} web banking` : "FinX", description: "Sandbox web banking. No real money moves." };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ project: string }> }) {
  const project = getProject((await params).project);
  if (!project) notFound();
  return (
    <html lang="en" data-brand={project.id}>
      <head><link rel="stylesheet" href={`/api/theme/${project.id}`} /></head>
      <body>
        <AppProvider project={{ id: project.id, preset: project.brand.preset, name: project.def.name, shell: project.shell, currency: project.def.currency }}>{children}</AppProvider>
      </body>
    </html>
  );
}
