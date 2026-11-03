"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { BankworkxShell } from "./bankworkx/Shell";
import { useApp } from "./AppProvider";

/** Puts signed-in pages inside their bank's frame. A bank with the classic look draws its own pages without one. */
export function Frame({ children }: { children: React.ReactNode }) {
  const { project } = useApp();
  return project.shell === "bankworkx" ? <BankworkxShell>{children}</BankworkxShell> : <>{children}</>;
}

/** A page that exists only for banks with a given look; other banks are sent to their home. */
export function OnlyFor({ shell, children }: { shell: "meezan" | "bankworkx"; children: React.ReactNode }) {
  const { project } = useApp();
  const router = useRouter();
  const path = usePathname();
  const ok = project.shell === shell;
  useEffect(() => { if (!ok) router.replace(`/${project.id}/${project.shell === "bankworkx" ? "dashboard" : "home"}`); }, [ok, router, project.id, project.shell, path]);
  return ok ? <>{children}</> : null;
}
