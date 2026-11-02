"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { can as roleCan, COOKIE_USER, type Action, type Role } from "@/lib/roles";

export type PersonInfo = { id: string; name: string; role: Role };
type Ctx = { people: PersonInfo[]; you: PersonInfo; can: (a: Action) => boolean; setYou: (id: string) => void };
const C = createContext<Ctx | null>(null);

/** Who is using Studio (a demo identity chosen in the sidebar, not a sign-in) and what their role allows. */
export function WhoProvider({ people, youId, children }: { people: PersonInfo[]; youId: string; children: React.ReactNode }) {
  const router = useRouter();
  const you = people.find((p) => p.id === youId) ?? people[0]!;
  const setYou = useCallback((id: string) => { document.cookie = `${COOKIE_USER}=${id}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }, [router]);
  const value = useMemo(() => ({ people, you, can: (a: Action) => roleCan(you.role, a), setYou }), [people, you, setYou]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useWho() { const v = useContext(C); if (!v) throw new Error("useWho needs WhoProvider"); return v; }
