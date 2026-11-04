import type { Metadata } from "next";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "@fontsource-variable/inter";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/600.css";
import "./globals.css";
import "./futuristic.css";
import { Shell } from "@/components/Shell";
import { ProjectsProvider } from "@/components/Projects";
import { COOKIE } from "@/lib/project-utils";
import { listProjects } from "@/lib/projects";
import { WhoProvider } from "@/components/Who";
import { actorFromId, listPeople } from "@/lib/people";
import { listRoles } from "@/lib/access";
import { COOKIE_USER } from "@/lib/roles";
import { COOKIE_SESSION, isProduction } from "@/lib/profile";
import { verifySession } from "@/lib/session";

export const metadata: Metadata = { title: "FinX Studio", description: "Build and publish banking journeys" };
export const dynamic = "force-dynamic";

/** Applies a saved theme before first paint so there is no flash of the wrong one. */
const THEME_INIT = `try{var t=localStorage.getItem("finx.theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const production = isProduction();
  // the sign-in page shows nothing about the workspace: no people, no projects
  if (production && (await headers()).get("x-finx-bare") === "1") {
    return <html lang="en" suppressHydrationWarning><body><Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />{children}</body></html>;
  }
  const sessionId = production ? verifySession((await cookies()).get(COOKIE_SESSION)?.value) : null;
  if (production && !sessionId) redirect("/login");
  const projects = await listProjects();
  const saved = (await cookies()).get(COOKIE)?.value;
  const [people, roles] = await Promise.all([listPeople(), listRoles()]);
  const you = await actorFromId(production ? sessionId! : (await cookies()).get(COOKIE_USER)?.value);
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <WhoProvider people={people} roles={roles} youId={you.id} production={production}><ProjectsProvider projects={projects} currentId={currentId}><Shell>{children}</Shell></ProjectsProvider></WhoProvider>
      </body>
    </html>
  );
}
