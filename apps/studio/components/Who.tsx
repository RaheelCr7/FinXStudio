"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { canDo, COOKIE_USER, roleIn, roleLabel, type Access, type Action, type Role, type RoleDef } from "@/lib/roles";

export type PersonInfo = { id: string; name: string; role: Role; access?: Access };
type Ctx = {
  people: PersonInfo[]; you: PersonInfo; roles: RoleDef[];
  /** Whether you may do an action; for project work name the projects (a journey's apps) so your role there is used. */
  can: (a: Action, projects?: string[]) => boolean;
  /** The words for your role (in a project, when named). */
  roleName: (person: PersonInfo, project?: string) => string;
  setYou: (id: string) => void;
};
const C = createContext<Ctx | null>(null);

/** Who is using Studio (a demo identity chosen in the sidebar, not a sign-in) and what their roles allow. */
export function WhoProvider({ people, roles, youId, children }: { people: PersonInfo[]; roles: RoleDef[]; youId: string; children: React.ReactNode }) {
  const router = useRouter();
  const you = people.find((p) => p.id === youId) ?? people[0]!;
  const setYou = useCallback((id: string) => { document.cookie = `${COOKIE_USER}=${id}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }, [router]);
  const value = useMemo<Ctx>(() => ({
    people, you, roles, setYou,
    can: (a, projects) => canDo(you, a, projects, roles),
    roleName: (p, project) => roleLabel(roleIn(p, project), roles),
  }), [people, you, roles, setYou]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useWho() { const v = useContext(C); if (!v) throw new Error("useWho needs WhoProvider"); return v; }
