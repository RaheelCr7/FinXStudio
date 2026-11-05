"use client";
import { useEffect } from "react";
import type { WorkspaceId } from "@finx/ui-kit";
import { workspaceFromSearch } from "@/lib/workspace";

/**
 * Puts `data-workspace` on the page, which picks the bank's look for that workspace (see themeCss). The shell's context store sets it
 * when the customer switches workspace; until then a preview address can: `?workspace=business`. Banks without workspace looks ignore it.
 */
export function WorkspaceScope({ workspace }: { workspace?: WorkspaceId }) {
  useEffect(() => {
    const w = workspace ?? workspaceFromSearch(window.location.search);
    const el = document.documentElement;
    if (w) el.dataset.workspace = w; else delete el.dataset.workspace;
    return () => { delete el.dataset.workspace; };
  }, [workspace]);
  return null;
}
