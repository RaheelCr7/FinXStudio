import { describe, expect, it } from "vitest";
import { Journey as JourneySchema } from "@finx/journey-schema";
import { checkExpression, evaluate } from "./expr";
import { lintExpressions } from "./lint-expr";
import { JourneyRunner, type RunnerOptions } from "./runner";

const journey = (blocks: any[], dataModel: any = {}, extra: any = {}) => JourneySchema.parse({
  id: "jrn_t", slug: "t", name: "T", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en"] }, entryScreen: "s", dataModel, integrations: [],
  screens: [
    { id: "s", title: "S", blocks: [...blocks, { type: "button", label: "Go", actions: [{ type: "validate" }, { type: "navigate", to: "end" }] }] },
    { id: "end", title: "Done", kind: "terminal", blocks: [{ type: "result", tone: "success", title: "Paid", text: "To {{p.payee}}", meta: "Ref {{p.ref}}" }, { type: "reviewSummary", rows: [{ label: "Amount", value: "{{p.amount | money2:USD}}" }] }, { type: "button", label: "Receipt", actions: [{ type: "share", template: "receipt" }] }] },
  ],
  ...extra,
});
const start = async (j: any, launch: Record<string, any> = {}, opts: Partial<RunnerOptions> = {}) => {
  const r = new JourneyRunner(j, { adapter: async () => ({}), launch, ...opts });
  await r.start();
  return r;
};
const view = (r: JourneyRunner, type: string) => r.view().blocks.find((b) => b.type === type)!;

describe("fileUpload", () => {
  const j = () => journey([{ type: "fileUpload", bind: "up", label: "File", accept: ["csv", "xml"] }], { up: { type: "object", required: true } });
  it("hands the renderer the accept list and the hint", async () => {
    const b = view(await start(j()), "fileUpload");
    expect(b.acceptAttr).toBe(".csv,.xml");
    expect(b.hint).toBe("CSV or XML, up to 256 KB.");
  });
  it("is required when the data model says so, and refuses a value that is the wrong kind or too big", async () => {
    const r = await start(j());
    expect(r.validate()).toBe(false);
    expect(r.errors.up).toBe("Required");
    r.set("up", { name: "x.pdf", size: 10, kind: "pdf" });
    expect(r.validate()).toBe(false);
    expect(r.errors.up).toBe("Use a CSV or XML file.");
    r.set("up", { name: "x.csv", size: 300 * 1024, kind: "csv" });
    expect(r.validate()).toBe(false);
    r.set("up", { name: "x.csv", size: 100, kind: "csv", content: "a" });
    expect(r.validate()).toBe(true);
  });
});

describe("documentViewer", () => {
  const j = () => journey([{ type: "documentViewer", bind: "read", title: "Terms", text: "## One\nFirst.\n\nSecond." }], { read: { type: "boolean" } });
  it("shows the paragraphs and does not let the screen go on until the end was reached", async () => {
    const r = await start(j());
    expect(view(r, "documentViewer").paragraphs).toEqual([{ heading: "One", text: "First." }, { text: "Second." }]);
    expect(r.validate()).toBe(false);
    expect(r.errors.read).toBe("Read the document to the end first.");
    r.set("read", true);
    expect(r.validate()).toBe(true);
  });
});

describe("signature", () => {
  const j = (extra: any = {}) => journey([{ type: "signature", bind: "sig", label: "Sign", ...extra }], { sig: { type: "object", required: true }, "ctx.name": { type: "string" } });
  it("checks a typed name against the expected one, read from the data", async () => {
    const r = await start(j({ expectedName: "{{who.name}}" }), { "who.name": "Alex Morgan" });
    expect(view(r, "signature").expectedName).toBe("Alex Morgan");
    r.set("sig", { mode: "type", name: "Someone Else" });
    expect(r.validate()).toBe(false);
    r.set("sig", { mode: "type", name: "alex morgan" });
    expect(r.validate()).toBe(true);
  });
  it("offers typing and drawing unless the block narrows them", async () => {
    expect(view(await start(j()), "signature").modes).toEqual(["type", "draw"]);
    expect(view(await start(j({ modes: ["type"] })), "signature").modes).toEqual(["type"]);
  });
});

describe("idCapture", () => {
  const j = () => journey([{ type: "idCapture", bind: "id", label: "ID", steps: ["front", "selfie"] }], { id: { type: "object" } });
  it("holds the screen until every step was captured, even when the data model does not say required", async () => {
    const r = await start(j());
    expect(view(r, "idCapture").steps.map((s: any) => s.done)).toEqual([false, false]);
    expect(r.validate()).toBe(false);
    expect(r.errors.id).toBe("Still to capture: front of the document, selfie.");
    r.set("id", { front: { ref: "SIM-FRONT-1" }, selfie: { ref: "SIM-SELFIE-1" } });
    expect(view(r, "idCapture").steps.map((s: any) => s.done)).toEqual([true, true]);
    expect(r.validate()).toBe(true);
  });
});

describe("share (receipts)", () => {
  const data = { "p.payee": "Zeta Supplies", "p.ref": "CORP-7", "p.amount": 1200.5 };
  const toEnd = async (opts: Partial<RunnerOptions>, j = journey([])) => { const r = await start(j, data, opts); await r.press([{ type: "navigate", to: "end" }]); return r; };
  it("hands the player a receipt made from the screen: the result's title, the review rows, the text and the reference", async () => {
    const got: any[] = [];
    const r = await toEnd({ onShare: (x) => got.push(x) });
    await r.press([{ type: "share", template: "receipt" }]);
    expect(got).toEqual([{ title: "Paid", lines: [{ label: "Amount", value: "$1,200.50" }, { label: "", value: "To Zeta Supplies" }, { label: "", value: "Ref CORP-7" }], text: "Paid\nAmount: $1,200.50\nTo Zeta Supplies\nRef CORP-7" }]);
  });
  it("uses the rows and title the action gives", async () => {
    const got: any[] = [];
    const r = await toEnd({ onShare: (x) => got.push(x) });
    await r.press([{ type: "share", template: "receipt", title: "Transfer receipt", rows: [{ label: "To", value: "{{p.payee}}" }] }]);
    expect(got[0]).toMatchObject({ title: "Transfer receipt", lines: [{ label: "To", value: "Zeta Supplies" }] });
  });
  it("does nothing, and does not fail, when no player can print or share", async () => {
    const r = await toEnd({});
    await expect(r.press([{ type: "share", template: "receipt" }])).resolves.toBeUndefined();
  });
  it("reports only that a receipt was shared", async () => {
    const events: any[] = [];
    const r = await toEnd({ onShare: () => {}, onEvent: (e) => events.push(e) });
    await r.press([{ type: "share", template: "receipt" }]);
    expect(events.filter((e) => e.type === "share")).toEqual([{ type: "share", screen: "end" }]);
  });
});

describe("session.permissions", () => {
  const gated = () => journey([{ type: "text", text: "Pay a supplier", visibleWhen: "has(session.permissions, 'biz.payments.initiate')" }, { type: "text", text: "No access", visibleWhen: "!has(session.permissions, 'biz.payments.initiate')" }]);
  const texts = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "text").map((b) => b.text);
  it("shows what the permission allows and hides the rest", async () => {
    expect(texts(await start(gated(), {}, { session: { permissions: ["biz.payments.initiate"] } }))).toEqual(["Pay a supplier"]);
    expect(texts(await start(gated(), {}, { session: { permissions: ["biz.approvals.view"] } }))).toEqual(["No access"]);
    expect(texts(await start(gated()))).toEqual(["No access"]);
  });
  it("cannot be written by the journey, a block, a launch value or the app after it started", async () => {
    const j = journey([], {}, {});
    j.screens[0]!.onEnter = [{ type: "setData", path: "session.permissions", value: "x" }];
    const r = await start(j, { "session.permissions": ["forged"] }, { session: { permissions: ["a"] } });
    r.set("session.permissions", ["forged"]);
    expect(r.get("session.permissions")).toEqual(["a"]);
    expect(() => { (r.get("session.permissions") as string[]).push("x"); }).toThrow();
  });
  it("has() reads lists and maps", () => {
    expect([evaluate("has(a, 'x')", { a: ["x"] }), evaluate("has(a, 'y')", { a: ["x"] }), evaluate("has(m, 'k')", { m: { k: 1 } }), evaluate("has(z, 'k')", {})]).toEqual([true, false, true, false]);
    expect(checkExpression("has(session.permissions, 'x')")).toBeNull();
  });
  it("is known to lint, while the journey's own session.* answers are still checked", () => {
    const ok = journey([{ type: "text", text: "x", visibleWhen: "has(session.permissions, 'a')" }]);
    expect(lintExpressions(ok).filter((i) => i.message.includes("session"))).toEqual([]);
    const own = journey([{ type: "text", text: "x", visibleWhen: "session.userId == 'a'" }], { "session.userId": { type: "string" } });
    expect(lintExpressions(own).filter((i) => i.message.includes("session"))).toEqual([]);
    const bad = journey([{ type: "text", text: "x", visibleWhen: "session.userid == 'a'" }], { "session.userId": { type: "string" } });
    expect(lintExpressions(bad).filter((i) => i.message.includes("session")).map((i) => i.code)).toEqual(["unknown_field"]);
  });
  it("leaves the journey's own session.* answers writable next to the app's permissions", async () => {
    const r = await start(journey([]), {}, { session: { permissions: ["a"] } });
    r.set("session.userId", "hassan");
    expect(r.get("session")).toEqual({ permissions: ["a"], userId: "hassan" });
  });

});
