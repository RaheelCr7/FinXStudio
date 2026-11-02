"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp, useAppState } from "./AppProvider";

/**
 * Signed-in pages only. The sandbox holds no real data, but the rule is kept honest: without a session, go to sign in and come back after.
 * Nothing is drawn until the session has been looked for, so the signed-out state never flashes.
 */
export function Guard({ children }: { children: React.ReactNode }) {
  const { project, ready } = useApp();
  const state = useAppState();
  const router = useRouter();
  const path = usePathname();
  const signedIn = state.screen !== "login";
  useEffect(() => { if (ready && !signedIn) router.replace(`/${project.id}/login?next=${encodeURIComponent(path)}`); }, [ready, signedIn, router, project.id, path]);
  if (!ready || !signedIn) return <main className="wb-loading" aria-busy="true"><span className="wb-sr">Loading</span></main>;
  return <>{children}</>;
}
