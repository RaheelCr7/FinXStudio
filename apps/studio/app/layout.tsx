import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { ProjectsProvider } from "@/components/Projects";
import { COOKIE } from "@/lib/project-utils";
import { listProjects } from "@/lib/projects";

export const metadata: Metadata = { title: "FinX Studio", description: "Build and publish banking journeys" };
export const dynamic = "force-dynamic";

/** Applies a saved theme before first paint so there is no flash of the wrong one. */
const THEME_INIT = `try{var t=localStorage.getItem("finx.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects();
  const saved = (await cookies()).get(COOKIE)?.value;
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <ProjectsProvider projects={projects} currentId={currentId}><Shell>{children}</Shell></ProjectsProvider>
      </body>
    </html>
  );
}
