import { beforeEach, describe, expect, it } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { payBill } from "@finx/journey-schema";
import { createFinxServer } from "./index";
import { FakeStudio } from "./testing/fake-studio";

async function connect(studio: FakeStudio, readOnly = false) {
  const server = createFinxServer({ studio, readOnly });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(st), client.connect(ct)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    const text = r.content?.[0]?.text ?? "";
    let json: any; try { json = JSON.parse(text); } catch { json = undefined; }
    return { isError: !!r.isError, text, json };
  };
  return { client, call, studio };
}

const TOOLS = ["finx_get_catalog", "finx_get_example", "finx_list_journeys", "finx_list_projects", "finx_list_catalog", "finx_add_from_catalog", "finx_get_journey", "finx_create_journey", "finx_save_draft", "finx_patch_journey", "finx_lint_journey", "finx_simulate_journey", "finx_publish_journey", "finx_report_run", "finx_list_requirements", "finx_get_requirement", "finx_save_requirement", "finx_ask_requirement"];

describe("FinX MCP server", () => {
  let studio: FakeStudio;
  beforeEach(() => { studio = new FakeStudio(["fund-transfer-local"]); });

  it("advertises the tools, with descriptions and safety annotations, and the journey prompt", async () => {
    const { client } = await connect(studio);
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOLS].sort());
    for (const t of tools) expect(t.description!.length, t.name).toBeGreaterThan(60);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName.finx_get_catalog!.annotations?.readOnlyHint).toBe(true);
    expect(byName.finx_simulate_journey!.annotations?.readOnlyHint).toBe(true);
    expect(byName.finx_save_draft!.annotations?.readOnlyHint).toBe(false);
    const prompts = (await client.listPrompts()).prompts;
    expect(prompts.map((p) => p.name)).toEqual(["journey"]);
    const p: any = await client.getPrompt({ name: "journey", arguments: { brief: "mobile top-up with OTP" } });
    expect(p.messages[0].content.text).toContain("Brief: mobile top-up with OTP");
    expect(p.messages[0].content.text).not.toContain("argument-hint");
    expect(client.getInstructions()).toContain("finx_get_catalog");
  });

  it("serves the catalog by section and the shipped examples", async () => {
    const { call } = await connect(studio);
    const all = await call("finx_get_catalog");
    expect(Object.keys(all.json)).toEqual(expect.arrayContaining(["overview", "journey", "blocks", "actions", "expressions", "data", "localization", "adapters", "personas", "lint", "patterns"]));
    expect(Object.keys((await call("finx_get_catalog", { section: "adapters" })).json)).toEqual(["adapters"]);
    expect((await call("finx_get_example", { name: "pay-a-bill" })).json.slug).toBe("pay-a-bill");
  });

  it("lists and reads journeys, and reports unpublished drafts", async () => {
    const { call } = await connect(studio);
    const list = await call("finx_list_journeys");
    expect(list.json.journeys[0]).toMatchObject({ slug: "fund-transfer-local", publishedVersion: 5 });
    const got = await call("finx_get_journey", { slug: "fund-transfer-local" });
    expect(got.json).toMatchObject({ publishedVersion: 5, draftDiffersFromPublished: false, issues: [] });
    expect(got.json.studioUrl).toBe("http://studio.test/journeys/fund-transfer-local");
    expect((await call("finx_get_journey", { slug: "missing" })).isError).toBe(true);
  });

  it("lists the projects, and creates a journey inside one so only that bank's app shows it", async () => {
    const { call } = await connect(studio);
    const projects = await call("finx_list_projects");
    expect(projects.json.projects.map((p: any) => p.id)).toEqual(["meezan", "bankworkx"]);
    const created = await call("finx_create_journey", { name: "Send a gift", project: "bankworkx" });
    expect(created.json.journey.apps).toEqual(["bankworkx"]);
    expect((await call("finx_create_journey", { name: "Other gift", project: "nobody" })).isError).toBe(true);
    expect((await call("finx_create_journey", { name: "Plain journey" })).json.journey.apps).toBeUndefined();
  });

  it("browses the catalog and adds a ready-made journey to a project as a draft, never published", async () => {
    const { call } = await connect(studio);
    const before = await call("finx_list_catalog", { project: "bankworkx" });
    expect(before.json.catalog.map((c: any) => c.id)).toContain("add-money");
    expect(before.json.catalog.find((c: any) => c.id === "add-money").added).toBeNull();
    const added = await call("finx_add_from_catalog", { id: "add-money", project: "bankworkx" });
    expect(added.json.slug).toBe("add-money-bankworkx");
    expect((await call("finx_get_journey", { slug: "add-money-bankworkx" })).json).toMatchObject({ publishedVersion: null });
    expect((await call("finx_list_catalog", { project: "bankworkx" })).json.catalog.find((c: any) => c.id === "add-money").added).toBe("add-money-bankworkx");
    expect((await call("finx_add_from_catalog", { id: "add-money", project: "bankworkx" })).isError).toBe(true);
    expect((await call("finx_add_from_catalog", { id: "nope", project: "bankworkx" })).isError).toBe(true);
  });

  it("creates, saves, simulates and hands over a whole journey the way the skill does", async () => {
    const { call } = await connect(studio);
    const run = await call("finx_report_run", { title: "Create pay a bill", brief: "pay a bill", status: "running" });
    expect(run.json.runId).toBe("run_1");

    const created = await call("finx_create_journey", { name: "Pay a bill 2" });
    expect(created.json.slug).toBe("pay-a-bill-2");

    // the agent writes the full journey with the slug it was given
    const journey = { ...structuredClone(payBill), id: created.json.journey.id, slug: "pay-a-bill-2", version: 0, status: "draft" };
    const saved = await call("finx_save_draft", { journey });
    expect(saved.isError).toBe(false);
    expect(saved.json).toMatchObject({ saved: true, slug: "pay-a-bill-2", issues: [] });
    expect(saved.json.advice.some((a: string) => a.includes("has no onError"))).toBe(true); // accounts/billers/otpSend calls have no onError

    const sim = await call("finx_simulate_journey", {
      slug: "pay-a-bill-2",
      steps: [
        { set: { "bill.billerId": "k_electric", "bill.fromAccountId": "acc_current", "bill.reference": "0123456789", "bill.consent": true } },
        { press: "Find my bill" }, { expectScreen: "review" }, { press: "Confirm and send OTP" }, { set: { "otp.code": "482100" } }, { press: "Pay now" }, { expectScreen: "success" },
      ],
    });
    expect(sim.json).toMatchObject({ ok: true, finalScreen: "success" });
    expect(sim.json.bank.balances.acc_current).toBe(184250 - 7789);

    const report = await call("finx_report_run", { runId: "run_1", status: "needs_review", summary: "Built it", journeySlug: "pay-a-bill-2" });
    expect(report.json).toMatchObject({ runId: "run_1", status: "needs_review" });
    expect(studio.records.get("pay-a-bill-2")!.published).toBeUndefined(); // agents never publish on their own
  });

  it("reports every schema error with its path and saves nothing", async () => {
    const { call } = await connect(studio);
    await call("finx_create_journey", { name: "Broken one" });
    const bad: any = structuredClone(payBill); bad.slug = "broken-one"; delete bad.screens[0].blocks[2].bind; bad.screens[1].blocks[0].type = "nope";
    const r = await call("finx_save_draft", { journey: bad });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("screens[0].blocks[2].bind");
    expect(r.text).toContain("screens[1].blocks[0].type");
    expect(studio.calls.filter((c) => c.startsWith("save"))).toEqual([]);
  });

  it("returns lint issues and misspelled-field warnings, and tells the agent to create the journey first", async () => {
    const { call } = await connect(studio);
    const j: any = structuredClone(payBill); j.slug = "ghost";
    const notCreated = await call("finx_save_draft", { journey: j });
    expect(notCreated.isError).toBe(true);
    expect(notCreated.text).toContain("finx_create_journey");

    await call("finx_create_journey", { name: "Ghost" });
    j.screens[0].blocks[2].placeholdr = "x";
    j.screens[1].blocks[0].rows[0].value = "{{ctx.bil.billerName}}";
    const r = await call("finx_save_draft", { journey: j });
    expect(r.json.warnings.join(" ")).toContain("placeholdr");
    expect(r.json.issues.map((i: any) => i.code)).toContain("unknown_reference");
    expect(r.json.next).toContain("Fix every issue");
  });

  it("flags integrations that do not exist and a mis-named OTP verifier", async () => {
    const { call } = await connect(studio);
    const j: any = structuredClone(payBill);
    j.integrations.push({ id: "magic", adapter: "bank.magic.do", mode: "sandbox" });
    j.integrations.find((i: any) => i.id === "otpVerify").id = "verifyOtp";
    const r = await call("finx_lint_journey", { journey: j });
    const codes = r.json.issues.map((i: any) => i.code);
    expect(codes).toContain("unknown_adapter");
    expect(codes).toContain("otp_verify_name");
  });

  it("patches a draft with JSON Patch, atomically", async () => {
    const { call } = await connect(studio);
    const ok = await call("finx_patch_journey", { slug: "fund-transfer-local", operations: [
      { op: "test", path: "/screens/0/id", value: "account" },
      { op: "replace", path: "/screens/0/title", value: { en: "Choose account", ur: "اکاؤنٹ منتخب کریں" } },
    ] });
    expect(ok.json).toMatchObject({ saved: true, issues: [] });
    expect(studio.records.get("fund-transfer-local")!.draft.screens[0]!.title).toEqual({ en: "Choose account", ur: "اکاؤنٹ منتخب کریں" });

    const before = JSON.stringify(studio.records.get("fund-transfer-local")!.draft);
    const bad = await call("finx_patch_journey", { slug: "fund-transfer-local", operations: [
      { op: "replace", path: "/name", value: { en: "X", ur: "ایکس" } }, { op: "remove", path: "/screens/99" },
    ] });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("Operation 2");
    expect(JSON.stringify(studio.records.get("fund-transfer-local")!.draft)).toBe(before);

    const invalid = await call("finx_patch_journey", { slug: "fund-transfer-local", operations: [{ op: "replace", path: "/screens/0/blocks/1/type", value: "nope" }] });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toContain("does not match the FinX schema");
  });

  it("lint and simulate need exactly one of slug or journey", async () => {
    const { call } = await connect(studio);
    expect((await call("finx_lint_journey", {})).isError).toBe(true);
    expect((await call("finx_lint_journey", { slug: "fund-transfer-local", journey: payBill })).isError).toBe(true);
    expect((await call("finx_simulate_journey", { steps: [] })).text).toContain("exactly one of slug or journey");
  });

  it("publishing needs explicit confirmation and a lint-clean draft", async () => {
    const { client, call } = await connect(studio);
    // the schema refuses anything but confirmedByUser: true
    const refused: any = await client.callTool({ name: "finx_publish_journey", arguments: { slug: "fund-transfer-local" } }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }));
    expect(refused.isError).toBe(true);
    expect(studio.calls.some((c) => c.startsWith("publish"))).toBe(false);

    const dirty = structuredClone(studio.records.get("fund-transfer-local")!.draft); dirty.entryScreen = "nowhere";
    studio.records.get("fund-transfer-local")!.draft = dirty;
    const blocked = await call("finx_publish_journey", { slug: "fund-transfer-local", confirmedByUser: true });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("lint issue");
    expect(studio.calls.some((c) => c.startsWith("publish"))).toBe(false);

    dirty.entryScreen = "account";
    const done = await call("finx_publish_journey", { slug: "fund-transfer-local", confirmedByUser: true });
    expect(done.json).toMatchObject({ published: true, version: 6 });
  });

  it("read-only mode blocks every tool that changes a journey, but not reporting or reading", async () => {
    const { call } = await connect(studio, true);
    for (const [name, args] of [
      ["finx_create_journey", { name: "Nope nope" }],
      ["finx_save_draft", { journey: payBill }],
      ["finx_patch_journey", { slug: "fund-transfer-local", operations: [{ op: "test", path: "/name", value: 1 }] }],
      ["finx_publish_journey", { slug: "fund-transfer-local", confirmedByUser: true }],
    ] as const) {
      const r = await call(name, args as any);
      expect(r.isError, name).toBe(true);
      expect(r.text, name).toContain("read-only");
    }
    expect((await call("finx_get_catalog", { section: "overview" })).isError).toBe(false);
    expect((await call("finx_report_run", { title: "Review only" })).isError).toBe(false);
  });

  it("rejects oversized journeys and unsafe slugs", async () => {
    const { call, client } = await connect(studio);
    const huge: any = structuredClone(payBill); huge.screens[0].blocks[0].text = "x".repeat(210 * 1024);
    const r = await call("finx_save_draft", { journey: huge });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("too large");
    const bad: any = await client.callTool({ name: "finx_get_journey", arguments: { slug: "../etc/passwd" } }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }));
    expect(bad.isError).toBe(true);
  });

  it("explains an unreachable Studio instead of crashing", async () => {
    const { HttpStudioClient } = await import("./studio-client");
    const server = createFinxServer({ studio: new HttpStudioClient("http://127.0.0.1:9", undefined, 1500) });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const r: any = await client.callTool({ name: "finx_list_journeys", arguments: {} });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Cannot reach FinX Studio");
  });
});

describe("FinX MCP requirements tools", () => {
  const draft = { title: "Corporate payment", intent: "A company initiator sends a payment that an approver must release before it leaves the bank.", projectId: "meezan" };
  let studio: FakeStudio;
  beforeEach(() => { studio = new FakeStudio(["fund-transfer-local"]); });

  it("creates a draft, says what blocks approval, and gives the new items their ids", async () => {
    const { call } = await connect(studio);
    expect((await call("finx_save_requirement", { title: "Only a title" })).isError).toBe(true); // an intent is needed
    const made = await call("finx_save_requirement", { ...draft, actors: [{ name: "Initiator" }, { name: "Approver" }], steps: [{ text: "Enter the payment" }] });
    expect(made.json).toMatchObject({ id: "corporate-payment", status: "draft", version: 1, studioUrl: "http://studio.test/requirements/corporate-payment" });
    expect(made.json.blockers).toEqual(["Write at least one acceptance criterion (AC-1 …)."]);
    const got = await call("finx_get_requirement", { id: "corporate-payment" });
    expect(got.json.actors.map((a: any) => a.id)).toEqual(["A-1", "A-2"]);
    const upd = await call("finx_save_requirement", { id: "corporate-payment", criteria: [{ text: "A payment above the limit is refused" }] });
    expect(upd.json).toMatchObject({ status: "draft", blockers: [], resetApproval: false });
    expect((await call("finx_get_requirement", { id: "corporate-payment" })).json.criteria[0].id).toBe("AC-1");
  });

  it("lists requirements with their status and open questions", async () => {
    const { call } = await connect(studio);
    await call("finx_save_requirement", draft);
    await call("finx_ask_requirement", { id: "corporate-payment", text: "Who approves above 1,000,000?" });
    const list = await call("finx_list_requirements", { project: "meezan" });
    expect(list.json.requirements[0]).toMatchObject({ id: "corporate-payment", status: "questions", openQuestions: 1 });
    expect((await call("finx_list_requirements", { project: "bankworkx" })).json.requirements).toEqual([]);
  });

  it("asks a question the requirement waits on, and can never answer or approve", async () => {
    const { client, call } = await connect(studio);
    await call("finx_save_requirement", draft);
    const q = await call("finx_ask_requirement", { id: "corporate-payment", text: "What happens after the cut-off?" });
    expect(q.json).toMatchObject({ status: "questions", openQuestions: 1, question: { id: "Q-1", by: "Claude Code" } });
    expect((await call("finx_ask_requirement", { id: "nope", text: "Anything missing here?" })).isError).toBe(true);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.filter((n) => /approve|answer|delete/.test(n))).toEqual([]); // a person approves and answers, in Studio
  });

  it("says when a change takes an approved requirement back to a draft", async () => {
    const { call } = await connect(studio);
    await call("finx_save_requirement", { ...draft, actors: [{ name: "Initiator" }], steps: [{ text: "Enter" }], criteria: [{ text: "Refused above the limit" }] });
    studio.requirements.set("corporate-payment", { ...studio.requirements.get("corporate-payment")!, status: "approved", approvedBy: "Sam", approvedAt: "x" });
    const changed = await call("finx_save_requirement", { id: "corporate-payment", rules: [{ kind: "limit", text: "Daily limit 2,000,000" }] });
    expect(changed.json).toMatchObject({ status: "draft", version: 2, resetApproval: true });
    expect(changed.json.next).toContain("needs approving again");
  });

  it("refuses to change anything in read-only mode, but still reads", async () => {
    const { call } = await connect(studio, true);
    expect((await call("finx_save_requirement", draft)).isError).toBe(true);
    expect((await call("finx_ask_requirement", { id: "x", text: "A question here?" })).isError).toBe(true);
    expect((await call("finx_list_requirements")).isError).toBe(false);
  });
});
