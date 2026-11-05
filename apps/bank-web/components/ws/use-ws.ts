"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { linkPath, type LaunchPoint, type Link } from "@finx/bank-client";
import { useApp, useAppState } from "../AppProvider";

/** The address of a link inside this bank's app: /<project>/personal/cards, /<project>/business/alpha/j/supplier-payment?... */
export const wsHref = (project: string, link: Link) => `/${project}${linkPath(link)}`;

/** Everything a workspace component needs: the store, its state, the active place, and ways to move. */
export function useWs() {
  const { app, project } = useApp();
  const s = useAppState();
  const router = useRouter();
  const ctx = app.context;
  /** A link in the place the customer is in: the active place's own scope. */
  const here = useCallback((rest: { tab: Extract<Link, { tab: any }>["tab"] } | { journey: string; values: Record<string, string> }): Link => (
    ctx?.workspace === "business" ? { workspace: "business", companyId: ctx.id, ...rest } : { workspace: "personal", ...rest }) as Link, [ctx]);
  const go = useCallback((link: Link) => router.push(wsHref(project.id, link)), [router, project.id]);
  /** Opens a journey from a launch point with the values the place passed in. */
  const launch = useCallback((lp: LaunchPoint, passed: Record<string, unknown> = {}) => {
    const { slug, values } = app.launchTarget(lp, passed);
    const strings = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
    router.push(wsHref(project.id, here({ journey: slug, values: strings })));
  }, [app, router, project.id, here]);
  return { app, project, s, ctx, router, here, go, launch };
}
