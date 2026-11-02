"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Brand, BrandDef } from "@finx/ui-kit";
import { COOKIE, appsOfJourney } from "@/lib/project-utils";

export { COOKIE, appsOfJourney };

/** A bank app as the pages need it. `brand` is its resolved light and dark theme. */
export type ProjectInfo = BrandDef & { id: string; brand: Brand };
type Ctx = { projects: ProjectInfo[]; current: ProjectInfo; setCurrent: (id: string) => void; byId: (id: string) => ProjectInfo | undefined };
const C = createContext<Ctx | null>(null);


export function ProjectsProvider({ projects, currentId, children }: { projects: ProjectInfo[]; currentId: string; children: React.ReactNode }) {
  const router = useRouter();
  const current = projects.find((p) => p.id === currentId) ?? projects[0]!;
  const setCurrent = useCallback((id: string) => {
    document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ projects, current, setCurrent, byId: (id: string) => projects.find((p) => p.id === id) }), [projects, current, setCurrent]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useProjects() {
  const v = useContext(C); if (!v) throw new Error("useProjects needs ProjectsProvider");
  return v;
}

