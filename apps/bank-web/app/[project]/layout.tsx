import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/inter";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/600.css";
import "@finx/renderer-web/src/styles/renderer.css";
import "../globals.css";
import "../bankworkx.css";
import "../workspace.css";
import { AppProvider } from "@/components/AppProvider";
import { RegisterSW } from "@/components/RegisterSW";
import { WorkspaceScope } from "@/components/WorkspaceScope";
import { getProject } from "@/lib/projects";

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const p = await getProject((await params).project);
  return { title: p ? `${p.def.name} web banking` : "FinX", description: "Sandbox web banking. No real money moves." };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ project: string }> }) {
  const project = await getProject((await params).project);
  if (!project) notFound();
  return (
    <html lang="en" data-brand={project.id}>
      <head>
        <link rel="stylesheet" href={`/api/theme/${project.id}`} />
        <link rel="manifest" href={`/${project.id}/manifest.webmanifest`} />
        <link rel="icon" href={`/api/icon/${project.id}`} type="image/svg+xml" />
        <meta name="theme-color" content={project.def.accent} />
      </head>
      <body>
        <RegisterSW />
        <WorkspaceScope />
        <AppProvider project={{ id: project.id, preset: project.brand.preset, name: project.def.name, shell: project.shell, currency: project.def.currency, bankApi: project.def.bankApi, look: project.brand.look }}>{children}</AppProvider>
      </body>
    </html>
  );
}
