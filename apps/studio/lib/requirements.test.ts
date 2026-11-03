import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let req: typeof import("./requirements");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-req-"));
  req = await import("./requirements");
});

const good = {
  title: "Corporate payment", intent: "A company initiator sends a payment that an approver must release before it leaves.", projectId: "cab",
  actors: [{ name: "Initiator" }, { name: "Approver", role: "approver" }], steps: [{ text: "Initiator enters the payment" }, { text: "Approver releases it" }],
  rules: [{ kind: "limit", text: "Daily limit 1,000,000" }, { kind: "cutoff", text: "Cut-off 4 pm" }], criteria: [{ text: "A payment above the limit is refused" }],
};

describe("requirements", () => {
  it("creates a draft, gives each item its id, and starts at version 1", async () => {
    const r = await req.createRequirement(good);
    expect(r).toMatchObject({ id: "corporate-payment", status: "draft", version: 1, projectId: "cab" });
    expect(r.actors.map((a) => a.id)).toEqual(["A-1", "A-2"]);
    expect(r.rules.map((x) => x.id)).toEqual(["R-1", "R-2"]);
    expect(r.criteria[0]!.id).toBe("AC-1");
    expect((await req.createRequirement(good)).id).toBe("corporate-payment-2"); // the same title again gets its own id
  });
  it("refuses a requirement with no intent, or a clashing id", async () => {
    await expect(req.createRequirement({ title: "x" })).rejects.toThrow(/intent/);
    await req.createRequirement({ ...good, id: "pay" });
    await expect(req.createRequirement({ ...good, id: "pay" })).rejects.toThrow(/already exists/);
    await expect(req.createRequirement({ ...good, steps: [{ id: "S-1", text: "a" }, { id: "S-1", text: "b" }] })).rejects.toThrow(/S-1 is used twice/);
  });
  it("lists newest change first, and by project", async () => {
    await req.createRequirement({ ...good, title: "One" });
    await req.createRequirement({ ...good, title: "Two", projectId: "meezan" });
    expect((await req.listRequirements()).map((r) => r.title)).toEqual(["Two", "One"]);
    expect((await req.listRequirements("cab")).map((r) => r.title)).toEqual(["One"]);
  });
  it("edits content, keeps existing ids and adds new ones after them", async () => {
    const r = await req.createRequirement(good);
    const { requirement } = await req.updateRequirement(r.id, { criteria: [...r.criteria, { text: "An approver cannot release their own payment" }] });
    expect(requirement.criteria.map((c) => c.id)).toEqual(["AC-1", "AC-2"]);
    await expect(req.updateRequirement(r.id, { title: "" })).rejects.toThrow(/title/);
    await expect(req.updateRequirement("nope", {})).rejects.toThrow(/No requirement/);
  });
  it("waits for answers: asking puts it in questions, answering the last one puts it back to draft", async () => {
    const r = await req.createRequirement(good);
    let q = await req.askQuestion(r.id, "Who approves above 1,000,000?", "Claude");
    expect(q.status).toBe("questions"); expect(q.questions[0]).toMatchObject({ id: "Q-1", by: "Claude" });
    q = await req.askQuestion(r.id, "What happens after the cut-off?", "Claude");
    await expect(req.approveRequirement(r.id, "Sam")).rejects.toThrow(/Answer the open questions: Q-1, Q-2/);
    q = await req.answerQuestion(r.id, "Q-1", "The finance director", "Sam"); expect(q.status).toBe("questions");
    q = await req.answerQuestion(r.id, "Q-2", "It goes out the next working day", "Sam"); expect(q.status).toBe("draft");
    await expect(req.askQuestion(r.id, "  ", "Claude")).rejects.toThrow(/Write the question/);
    await expect(req.answerQuestion(r.id, "Q-9", "x", "Sam")).rejects.toThrow(/No question/);
  });
  it("approves only what is ready, once, and records who", async () => {
    const empty = await req.createRequirement({ title: "Thin", intent: "A thin requirement with a long enough intent sentence." });
    await expect(req.approveRequirement(empty.id, "Sam")).rejects.toThrow(/Not ready to approve/);
    const r = await req.createRequirement(good);
    expect((await req.getRequirement(r.id))).toMatchObject({ status: "draft" });
    const a = await req.approveRequirement(r.id, "Sam");
    expect(a).toMatchObject({ status: "approved", approvedBy: "Sam", version: 1 });
    await expect(req.approveRequirement(r.id, "Sam")).rejects.toThrow(/already approved/);
    expect(req.withReadiness(a).blockers).toEqual([]);
    expect(req.withReadiness(await req.getRequirement(empty.id)).blockers.length).toBeGreaterThan(0);
  });
  it("takes an approved requirement back to draft, with a new version, when its content changes", async () => {
    const r = await req.createRequirement(good);
    await req.approveRequirement(r.id, "Sam");
    const same = await req.updateRequirement(r.id, { title: "Corporate payment" });
    expect(same.resetApproval).toBe(false); expect(same.requirement.status).toBe("approved");
    const changed = await req.updateRequirement(r.id, { rules: [{ kind: "limit", text: "Daily limit 2,000,000" }] });
    expect(changed.resetApproval).toBe(true);
    expect(changed.requirement).toMatchObject({ status: "draft", version: 2, approvedBy: undefined });
    const asked = await req.approveRequirement(r.id, "Sam").then((a) => req.askQuestion(a.id, "Is that per user?", "Claude"));
    expect(asked).toMatchObject({ status: "questions", version: 3 });
  });
  it("deletes a draft but not an approved requirement", async () => {
    const a = await req.createRequirement(good), b = await req.createRequirement({ ...good, title: "Other" });
    await req.approveRequirement(a.id, "Sam");
    await expect(req.deleteRequirement(a.id)).rejects.toThrow(/cannot be deleted/);
    await req.deleteRequirement(b.id);
    expect((await req.listRequirements()).map((r) => r.id)).toEqual([a.id]);
  });
});
