import { WORKSPACES, type WorkspaceId } from "@finx/ui-kit";

/** The workspace a preview address asks for (?workspace=business), or undefined for anything else. */
export function workspaceFromSearch(search: string): WorkspaceId | undefined {
  const v = new URLSearchParams(search).get("workspace");
  return WORKSPACES.find((w) => w === v);
}
