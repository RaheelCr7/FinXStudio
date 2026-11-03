import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "./globals.css";
import "./futuristic.css";
import { Shell } from "@/components/Shell";
import { ProjectsProvider } from "@/components/Projects";
import { COOKIE } from "@/lib/project-utils";
import { listProjects } from "@/lib/projects";
import { WhoProvider } from "@/components/Who";
import { actorFromId, listPeople } from "@/lib/people";
import { COOKIE_USER } from "@/lib/roles";

export const metadata: Metadata = { title: "FinX Studio", description: "Build and publish banking journeys" };
export const dynamic = "force-dynamic";

/** Applies a saved theme before first paint so there is no flash of the wrong one. */
const THEME_INIT = `try{var t=localStorage.getItem("finx.theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects();
  const saved = (await cookies()).get(COOKIE)?.value;
  const people = await listPeople();
  const you = await actorFromId((await cookies()).get(COOKIE_USER)?.value);
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <WhoProvider people={people} youId={you.id}><ProjectsProvider projects={projects} currentId={currentId}><Shell>{children}</Shell></ProjectsProvider></WhoProvider>
      </body>
    </html>
  );
}
