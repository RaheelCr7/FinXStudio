"use client";
import { useEffect } from "react";

/** Registers the service worker in production, so the app can be installed and shows an offline page. Does nothing in development. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* not available: the app works without it */ });
  }, []);
  return null;
}
