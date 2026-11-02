"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server data every few seconds, so a run that is in progress updates on screen. */
export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), everyMs); return () => clearInterval(t); }, [router, everyMs]);
  return null;
}
