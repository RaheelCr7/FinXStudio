import { describe, expect, it } from "vitest";
import { Journey } from "@finx/journey-schema";
import { JourneyController } from "./controller";

const journey = () => Journey.parse({
  id: "jrn_t", slug: "t", name: "T", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en"] }, entryScreen: "s",
  dataModel: {}, integrations: [{ id: "who", adapter: "bank.who", mode: "sandbox" }],
  screens: [
    { id: "s", title: "S", kind: "branch", onEnter: [{ type: "callApi", integration: "who", saveAs: "w" }, { type: "setData", path: "picked", value: "{{isEmpty(launch.id) ? '' : launch.id}}" }, { type: "setData", path: "launch.id", value: "" }, { type: "navigate", to: "end" }], blocks: [] },
    { id: "end", title: "Done", kind: "terminal", blocks: [{ type: "text", text: "Picked {{picked}}" }] },
  ],
});

describe("JourneyController.start", () => {
  it("runs the first screen once however often it is called (React runs an effect twice in development)", async () => {
    let calls = 0;
    const c = new JourneyController(journey(), { adapter: async () => { calls++; return {}; }, launch: { "launch.id": "PAY-2041" } });
    await Promise.all([c.start(), c.start()]);
    await c.start();
    expect(calls).toBe(1);
    // a launch value that is used once is still there for the one run that uses it
    expect(JSON.stringify(c.layout().view.blocks)).toContain("Picked PAY-2041");
  });
});
