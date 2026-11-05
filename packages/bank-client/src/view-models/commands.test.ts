import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import { LAUNCH_POINTS } from "../launch-points";
import type { ContextInfo } from "../session";
import { commandsFor, filterCommands } from "./commands";

const contexts = async () => (await new MockBank("alex").call("bank.session.get")).contexts as ContextInfo[];
const entries = [...new Set(LAUNCH_POINTS.map((l) => l.journey))].map((slug) => ({ slug }));

describe("the command bar", () => {
  it("offers tabs, journeys that need no values and the other places, for the active place only", async () => {
    const all = await contexts();
    const cmds = commandsFor({ context: all[0], entries }, all);
    const labels = cmds.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["Home", "Cards", "Send money", "Between my accounts", "Alpha Trading LLC", "Beta Services Ltd"]));
    expect(cmds.filter((c) => c.kind === "go" && c.id === "go:cards")[0]).toMatchObject({ link: { workspace: "personal", tab: "cards" } });
    expect(cmds.some((c) => c.kind === "journey" && c.launch.workspace === "business")).toBe(false);
    expect(cmds.find((c) => c.kind === "journey" && c.launch.journey === "freeze-card")).toBeUndefined(); // needs a card
    expect(cmds.find((c) => c.kind === "switch" && c.contextId === "beta")!.hint).toBe("Switch · Approver");
  });
  it("follows permissions: Alpha offers supplier payments, not approvals, and Admin is not offered to a Maker", async () => {
    const all = await contexts();
    const cmds = commandsFor({ context: all[1], entries }, all);
    expect(cmds.some((c) => c.kind === "journey" && c.launch.journey === "supplier-payment")).toBe(true);
    expect(cmds.some((c) => c.kind === "journey" && c.launch.journey === "approve-payments")).toBe(false);
    expect(cmds.some((c) => c.id === "go:admin")).toBe(false);
    expect(cmds.find((c) => c.kind === "go" && c.id === "go:approvals")).toMatchObject({ link: { workspace: "business", companyId: "alpha", tab: "approvals" } });
    expect(cmds.find((c) => c.kind === "switch" && c.contextId === "personal")!.label).toBe("Personal");
  });
  it("honours the bank's disabled list", async () => {
    const all = await contexts();
    const cmds = commandsFor({ context: all[0], entries, settings: { disabled: ["mobile-topup"], options: {} } }, all);
    expect(cmds.some((c) => c.kind === "journey" && c.launch.journey === "mobile-topup")).toBe(false);
  });
  it("filters by every word typed, with matches that start the label first", async () => {
    const all = await contexts();
    const cmds = commandsFor({ context: all[0], entries }, all);
    expect(filterCommands(cmds, "").length).toBe(8);
    expect(filterCommands(cmds, "ca").map((c) => c.label)[0]).toBe("Cards");
    expect(filterCommands(cmds, "switch beta").map((c) => c.label)).toEqual(["Beta Services Ltd"]);
    expect(filterCommands(cmds, "zzzz")).toEqual([]);
    expect(commandsFor({ context: undefined, entries }, all)).toEqual([]);
  });
});
