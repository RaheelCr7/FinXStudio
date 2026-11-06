import { describe, expect, it } from "vitest";
import { MockBank } from "../index";
import { alexMore, emptyMore, SHARING } from "./more";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const alex = (opts: ConstructorParameters<typeof MockBank>[1] = {}) => { const b = new MockBank("alex", { now: NOW, ...opts }); return b; };
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code?: string }).code ?? (e as Error).message);
/** The person's own code, as the journeys ask for it (the strict one-time code to the number on file). */
async function otp(b: MockBank) { await b.call("bank.otp.send", { channel: "sms", strict: true }); await b.call("bank.otp.verify", { code: "482100", strict: true }); }
const ADDR = { line1: "5 Pine Avenue", city: "Springfield", state: "IL", postal: "62704" };

describe("the profile: masked values, and every rule of a change", () => {
  it("shows the profile in full to its owner, and the contact details masked with what waits", async () => {
    const b = alex();
    expect(await b.call("bank.profile.get")).toMatchObject({ name: "Alex Morgan", phone: "+1 415 555 0142", phoneMasked: "•••• 0142", emailMasked: "a•••@example.com", addressText: "12 Harbour Road, Springfield, IL 10001", kycLevel: "Verified", pending: { mobile: false, email: false, address: false } });
    const c = await b.call("bank.profile.contacts");
    expect(c).toMatchObject({ market: "A", mobileHint: "10 digits", phoneEnding: "0142", state: true, postal: true, mobileMasked: "•••• 0142" });
    expect(c.choices.email.name).toBe("Email · a•••@example.com");
    expect(JSON.stringify(c)).not.toContain("415 555 0142");
    expect(JSON.stringify(c)).not.toContain("alex.morgan@example.com");
  });
  it("a mobile number follows the market, is not the current one (last 9 digits) and not someone else's", async () => {
    const b = alex();
    const t = (value: string) => code(b.call("bank.profile.update", { field: "mobile", value, dryRun: true }));
    expect(await t("123")).toBe("INVALID_MOBILE");
    expect(await t("415-555-0142")).toBe("SAME_VALUE");
    expect(await t("(415) 555 0142")).toBe("INVALID_MOBILE");
    expect(await t("4155550177")).toBe("CONTACT_IN_USE");
    expect(await t("555 010 0177")).toBe("ok");
    const uk = alex({ config: { homeMarket: "uk" } }), ae = alex({ config: { homeMarket: "ae" } }), eu = alex({ config: { homeMarket: "eu" } });
    expect(await code(uk.call("bank.profile.update", { field: "mobile", value: "5550100177", dryRun: true }))).toBe("INVALID_MOBILE");
    expect(await code(uk.call("bank.profile.update", { field: "mobile", value: "07700 900177", dryRun: true }))).toBe("ok");
    expect(await code(ae.call("bank.profile.update", { field: "mobile", value: "0501234567", dryRun: true }))).toBe("ok");
    expect(await code(ae.call("bank.profile.update", { field: "mobile", value: "5012345678", dryRun: true }))).toBe("INVALID_MOBILE");
    expect(await code(eu.call("bank.profile.update", { field: "mobile", value: "+4915112345678", dryRun: true }))).toBe("ok");
    expect(await code(eu.call("bank.profile.update", { field: "mobile", value: "1234567", dryRun: true }))).toBe("INVALID_MOBILE");
  });
  it("an email has a shape, is not the current one in other capitals and not someone else's; an address must differ and follow the market", async () => {
    const b = alex();
    const e = (value: string) => code(b.call("bank.profile.update", { field: "email", value, dryRun: true }));
    expect(await e("alex")).toBe("INVALID_EMAIL");
    expect(await e("a@b")).toBe("INVALID_EMAIL");
    expect(await e("Alex.Morgan@Example.com")).toBe("SAME_VALUE");
    expect(await e("sam.rivera@example.com")).toBe("CONTACT_IN_USE");
    expect(await e("x".repeat(80) + "@example.com")).toBe("INVALID_EMAIL");
    const a = (input: Record<string, unknown>) => code(b.call("bank.profile.update", { field: "address", dryRun: true, ...ADDR, ...input }));
    expect(await a({})).toBe("ok");
    expect(await a({ postal: "12" })).toBe("INVALID_POSTAL");
    expect(await a({ postal: "62704-1234" })).toBe("ok");
    expect(await a({ line1: "" })).toBe("ADDRESS_INCOMPLETE");
    expect(await a({ state: "" })).toBe("ADDRESS_INCOMPLETE");
    expect(await a({ line1: "x".repeat(61) })).toBe("ADDRESS_TOO_LONG");
    expect(await a({ line1: "12 harbour road", city: "SPRINGFIELD", state: "il", postal: "10001" })).toBe("SAME_VALUE");
    // Market D has no state and no postal code
    const ae = alex({ config: { homeMarket: "ae" } });
    expect(await code(ae.call("bank.profile.update", { field: "address", line1: "Example Tower, Flat 1204", city: "Dubai", dryRun: true }))).toBe("ok");
    expect((await ae.call("bank.profile.contacts"))).toMatchObject({ state: false, postal: false });
    expect(await code(alex({ config: { homeMarket: "uk" } }).call("bank.profile.update", { field: "address", line1: "5 Pine Road", city: "London", postal: "ZZZ", dryRun: true }))).toBe("INVALID_POSTAL");
    expect(await code(alex({ config: { homeMarket: "eu" } }).call("bank.profile.update", { field: "address", line1: "Beispielstrasse 5", city: "Berlin", postal: "123", dryRun: true }))).toBe("INVALID_POSTAL");
  });
  it("a dry run changes nothing and asks for no code; the real call needs the code, once", async () => {
    const b = alex();
    expect(await b.call("bank.profile.update", { field: "email", value: "new.alex@example.com", dryRun: true })).toMatchObject({ ok: true, wouldWait: true });
    expect((await b.call("bank.profile.get")).pending.email).toBe(false);
    expect(await code(b.call("bank.profile.update", { field: "email", value: "new.alex@example.com" }))).toBe("OTP_REQUIRED");
    await otp(b);
    expect(await b.call("bank.profile.update", { field: "email", value: "new.alex@example.com", verifyEmail: false })).toMatchObject({ status: "updated", title: "Email updated", valueText: "n•••@example.com" });
    // the code is spent
    expect(await code(b.call("bank.profile.update", { field: "email", value: "other.alex@example.com", verifyEmail: false }))).toBe("OTP_REQUIRED");
  });
  it("a new mobile number needs its own code, which has three tries; the old number is not the new one's code", async () => {
    const b = alex();
    await otp(b);
    expect(await code(b.call("bank.profile.update", { field: "mobile", value: "5550100177" }))).toBe("CONTACT_NOT_VERIFIED");
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "482100" }))).toBe("OTP_REQUIRED");
    expect(await b.call("bank.profile.sendContactCode", { channel: "sms", value: "5550100177" })).toMatchObject({ sent: true, masked: "•••• 0177" });
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "000000" }))).toBe("OTP_INVALID");
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "111111" }))).toBe("OTP_INVALID");
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "222222" }))).toBe("OTP_LOCKED");
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "482100" }))).toBe("OTP_LOCKED");
    await b.call("bank.profile.sendContactCode", { channel: "sms", value: "5550100177" });
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100177", code: "999999" }))).toBe("OTP_EXPIRED");
    expect(await code(b.call("bank.profile.verifyContact", { channel: "sms", value: "5550100188", code: "482100" }))).toBe("OTP_REQUIRED");
    expect(await b.call("bank.profile.verifyContact", { channel: "sms", value: "555 010 0177", code: "482100" })).toEqual({ verified: true });
    expect(await b.call("bank.profile.update", { field: "mobile", value: "5550100177" })).toMatchObject({ status: "updated", valueText: "•••• 0177", oldTold: true, oldToldText: "Told by message" });
    expect((await b.call("bank.profile.get")).phone).toBe("+1 555 010 0177");
    // the code of the next change goes to the new number
    expect(await b.call("bank.otp.send", { channel: "sms", strict: true })).toMatchObject({ last4: "0177" });
  });
  it("the number the customer signs in and is recovered with follows the change", async () => {
    const b = alex();
    await otp(b);
    await b.call("bank.profile.update", { field: "mobile", value: "5550100177", verifyNewMobile: false });
    expect(b.access.me()!.phone).toBe("+1 555 010 0177");
    await otp(b);
    await b.call("bank.profile.update", { field: "email", value: "new.alex@example.com", verifyEmail: false });
    expect(b.access.me()!.email).toBe("new.alex@example.com");
  });
  it("an email and an address wait when the bank checks them, once per item; the others are not stopped", async () => {
    const b = alex();
    await otp(b);
    expect(await b.call("bank.profile.update", { field: "email", value: "new.alex@example.com" })).toMatchObject({ status: "pending", title: "Change received", text: "Check your inbox and confirm the new address.", valueText: "n•••@example.com" });
    expect((await b.call("bank.profile.get"))).toMatchObject({ email: "alex.morgan@example.com", pending: { email: true, mobile: false } });
    expect((await b.call("bank.profile.contacts")).choices.email.name).toBe("Email · Pending n•••@example.com");
    expect(await code(b.call("bank.profile.update", { field: "email", value: "other.alex@example.com" }))).toBe("ALREADY_PENDING");
    await otp(b);
    expect(await b.call("bank.profile.update", { field: "address", ...ADDR })).toMatchObject({ status: "pending", text: "We’ll check it and tell you.", valueText: "5 Pine Avenue, Springfield, IL 62704" });
    expect((await b.call("bank.profile.get")).addressText).toBe("12 Harbour Road, Springfield, IL 10001");
    // the code of a refused change is not spent
    await otp(b);
    expect(await code(b.call("bank.profile.update", { field: "address", ...ADDR, line2: "Flat 2" }))).toBe("ALREADY_PENDING");
    expect(await b.call("bank.profile.update", { field: "mobile", value: "5550100177", verifyNewMobile: false })).toMatchObject({ status: "updated" });
  });
  it("an address applies at once when the bank does not check it, and keeps the second line", async () => {
    const b = alex({ config: { options: { "update-profile": { verifyAddress: false } } } });
    await otp(b);
    await b.call("bank.profile.update", { field: "address", ...ADDR, line2: "Flat 2" });
    expect((await b.call("bank.profile.get")).addressText).toBe("5 Pine Avenue, Flat 2, Springfield, IL 62704");
    await otp(b);
    await b.call("bank.profile.update", { field: "address", line1: "7 Oak Street", city: "Springfield", state: "IL", postal: "62704" });
    expect((await b.call("bank.profile.get")).addressText).toBe("7 Oak Street, Springfield, IL 62704");
  });
  it("proof of address is asked for only when the bank asks, and only a PDF, JPG or PNG will do", async () => {
    const b = alex({ config: { options: { "update-profile": { requireProof: true, verifyAddress: false } } } });
    await otp(b);
    expect(await code(b.call("bank.profile.update", { field: "address", ...ADDR }))).toBe("PROOF_REQUIRED");
    expect(await code(b.call("bank.profile.update", { field: "address", ...ADDR, proofName: "photo.heic" }))).toBe("FILE_TYPE");
    expect(await b.call("bank.profile.update", { field: "address", ...ADDR, proofName: "Utility-Bill.PDF" })).toMatchObject({ status: "updated" });
    const off = alex({ config: { options: { "update-profile": { verifyAddress: false } } } });
    await otp(off);
    expect(await off.call("bank.profile.update", { field: "address", ...ADDR })).toMatchObject({ status: "updated" });
  });
  it("the old and the new contact are told, to masked destinations, and the log and the notices hold no value", async () => {
    const b = alex();
    await otp(b); await b.call("bank.profile.update", { field: "mobile", value: "5550100177", verifyNewMobile: false });
    await otp(b); await b.call("bank.profile.update", { field: "email", value: "new.alex@example.com" });
    await otp(b); await b.call("bank.profile.update", { field: "address", ...ADDR });
    const seen = await b.call("sandbox.more.inspect");
    expect(seen.outbox).toEqual([
      { to: "•••• 0142", channel: "sms", kind: "old-mobile" }, { to: "•••• 0177", channel: "sms", kind: "new-mobile" },
      { to: "a•••@example.com", channel: "email", kind: "old-email" }, { to: "n•••@example.com", channel: "email", kind: "new-email" }, { to: "•••• 0177", channel: "sms", kind: "address" },
    ]);
    expect(seen.log).toEqual(["profile.mobile.updated", "profile.email.pending", "profile.address.pending"]);
    const dump = JSON.stringify([seen, b.persona.more!.outbox, b.persona.more!.log]);
    for (const secret of ["555 010 0177", "5550100177", "415 555 0142", "alex.morgan@example.com", "new.alex@example.com", "Pine", "Harbour"]) expect(dump, secret).not.toContain(secret);
    // the customer's notification list has a note for each, without the value
    const notes = Object.values<any>(await b.call("bank.notifications.list")).filter((n) => n.context === "personal").map((n) => n.text);
    expect(notes).toEqual(expect.arrayContaining(["Mobile number updated", "Email change received", "Address change received"]));
  });
  it("a refused change tells nobody and logs nothing, and a customer without a profile cannot change one", async () => {
    const b = alex();
    expect(await code(b.call("bank.profile.update", { field: "mobile", value: "123" }))).toBe("INVALID_MOBILE");
    expect(await b.call("sandbox.more.inspect")).toMatchObject({ outbox: [], log: [] });
    expect(await code(new MockBank("sam").call("bank.profile.update", { field: "mobile", value: "5550100177", dryRun: true }))).toBe("NOT_SUPPORTED");
    expect(await code(b.call("bank.profile.update", { field: "name", value: "Alex" }))).toBe("FIELD_INVALID");
  });
  it("the profile adapters need profile.update, and Meezan customers keep the older records", async () => {
    const b = alex({ conditions: { withoutPermissions: ["profile.update"] } });
    expect(await code(b.call("bank.profile.update", { field: "mobile", value: "5550100177", dryRun: true }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.profile.sendContactCode", { channel: "sms", value: "5550100177" }))).toBe("PERMISSION_DENIED");
    expect((await b.call("bank.profile.get")).name).toBe("Alex Morgan");
    expect(await code(new MockBank("ayesha").call("bank.profile.get"))).toBe("NOT_SUPPORTED");
    expect(await code(new MockBank("ayesha").call("bank.messages.list"))).toBe("NOT_SUPPORTED");
  });
});

describe("secure messages", () => {
  it("lists the conversations with the latest activity first, previews of 70 characters, dates and the unread mark", async () => {
    const b = alex();
    const list = await b.call("bank.messages.list");
    expect(Object.keys(list)).toEqual(["thr_card", "thr_fee"]);
    expect(list.thr_card).toMatchObject({ subject: "Your new card is on its way", topic: "Cards", status: "Answered", unread: true, read: false, dateText: "2 Nov", lastFrom: "bank", rank: 1, count: 1 });
    expect(list.thr_card.preview).toBe("Your replacement debit card has been sent. It should arrive in 3 to 5 …");
    expect(list.thr_fee).toMatchObject({ unread: false, dateText: "30 Oct", rank: 2, count: 2, reference: "MSG-20261029-0006" });
    expect(list.thr_fee.preview.length).toBeLessThanOrEqual(71);
  });
  it("opens a conversation with every message in order, and marking it read clears the mark", async () => {
    const b = alex();
    const t = await b.call("bank.messages.get", { threadId: "thr_fee" });
    expect(t.messages.map((m: any) => [m.who, m.mine, m.timeText])).toEqual([["You", true, "Thu 29 Oct, 14:30"], ["Sara, BankWorkx®", false, "Fri 30 Oct, 09:48"]]);
    expect(t).toMatchObject({ reference: "MSG-20261029-0006", status: "Answered", closed: false });
    expect((await b.call("bank.messages.get", { threadId: "thr_card" })).unread).toBe(true);
    await b.call("bank.messages.markRead", { threadId: "thr_card" });
    expect((await b.call("bank.messages.get", { threadId: "thr_card" })).unread).toBe(false);
    expect(await code(b.call("bank.messages.get", { threadId: "thr_nope" }))).toBe("THREAD_NOT_FOUND");
    expect(await code(b.call("bank.messages.markRead", { threadId: "thr_nope" }))).toBe("THREAD_NOT_FOUND");
  });
  it("sends a message with a topic, a subject, a text and a file, and the new conversation is first and read", async () => {
    const b = alex();
    expect(await b.call("bank.messages.send", { topic: "Cards", subject: "Lost card", text: "I lost my card on the train.", fileName: "report.PDF", fileSize: 5 * 1024 * 1024 })).toEqual({ threadId: "thr_3", reference: "MSG-20261103-0008" });
    const list = await b.call("bank.messages.list");
    expect(Object.keys(list)[0]).toBe("thr_3");
    expect(list.thr_3).toMatchObject({ unread: false, status: "Open", hasFile: true, lastFrom: "you", rank: 1 });
    expect((await b.call("bank.messages.get", { threadId: "thr_3" })).messages[0]).toMatchObject({ mine: true, who: "You", fileName: "report.PDF", fileText: "report.PDF · 5.0 MB" });
    expect((await b.call("bank.messages.send", { topic: "Cards", subject: "Second", text: "Another question for you." })).reference).toBe("MSG-20261103-0009");
  });
  it("refuses what a message needs: a topic from the list, 3 to 80 characters of subject, 10 to 1000 of text, a PDF, JPG or PNG up to 5 MB", async () => {
    const b = alex();
    const send = (input: Record<string, unknown>) => code(b.call("bank.messages.send", { topic: "Account", subject: "Question", text: "Please can you check a payment.", ...input }));
    expect(await send({})).toBe("ok");
    expect(await send({ topic: "Weather" })).toBe("TOPIC_INVALID");
    expect(await send({ subject: " ab " })).toBe("SUBJECT_INVALID");
    expect(await send({ subject: "s".repeat(81) })).toBe("SUBJECT_INVALID");
    expect(await send({ text: "too short" })).toBe("TEXT_INVALID");
    expect(await send({ text: "t".repeat(1001) })).toBe("TEXT_INVALID");
    expect(await send({ text: "t".repeat(1000) })).toBe("ok");
    expect(await send({ fileName: "a.exe", fileSize: 10 })).toBe("FILE_TYPE");
    expect(await send({ fileName: "a.pdf", fileSize: 5 * 1024 * 1024 + 1 })).toBe("FILE_TOO_LARGE");
    expect(await send({ fileName: "a.png", fileSize: 0 })).toBe("FILE_TOO_LARGE");
    expect(await send({ fileName: "a.jpeg", fileSize: 1000 })).toBe("ok");
    const off = alex({ config: { options: { "new-message": { allowFile: false } } } });
    expect(await code(off.call("bank.messages.send", { topic: "Account", subject: "Question", text: "Please can you check a payment.", fileName: "a.pdf", fileSize: 10 }))).toBe("FILE_NOT_ALLOWED");
  });
  it("keeps what was written as it was written: markup is text", async () => {
    const b = alex();
    const text = "<script>alert(1)</script> & <b>bold</b>";
    const { threadId } = await b.call("bank.messages.send", { topic: "Account", subject: "<i>hello</i>", text });
    const t = await b.call("bank.messages.get", { threadId });
    expect([t.subject, t.messages[0].text]).toEqual(["<i>hello</i>", text]);
    expect((await b.call("bank.messages.list"))[threadId].preview).toBe(text);
  });
  it("the bank answers a new conversation two seconds later, unread, and then the conversation is answered", async () => {
    let t = NOW;
    const b = alex({ now: () => t });
    const { threadId } = await b.call("bank.messages.send", { topic: "Account", subject: "Question", text: "Please can you check a payment." });
    expect((await b.call("bank.messages.list"))[threadId]).toMatchObject({ unread: false, status: "Open", count: 1 });
    t += 1999;
    expect((await b.call("bank.messages.list"))[threadId].count).toBe(1);
    t += 1;
    const after = (await b.call("bank.messages.list"))[threadId];
    expect(after).toMatchObject({ unread: true, status: "Answered", count: 2, lastFrom: "bank", preview: "Thanks Alex. We have your message and will reply within 1 working day." });
    expect((await b.call("bank.messages.get", { threadId })).messages[1].who).toBe("BankWorkx® Support");
    t += 10_000;
    expect((await b.call("bank.messages.list"))[threadId].count).toBe(2);
  });
  it("replies need 2 characters after trimming and at most 1000, and are refused for a conversation that is closed", async () => {
    const b = alex();
    const reply = (text: string, threadId = "thr_fee") => code(b.call("bank.messages.reply", { threadId, text }));
    expect(await reply("a")).toBe("REPLY_INVALID");
    expect(await reply("  a  ")).toBe("REPLY_INVALID");
    expect(await reply("")).toBe("REPLY_INVALID");
    expect(await reply("r".repeat(1001))).toBe("REPLY_INVALID");
    expect(await reply("Thanks")).toBe("ok");
    expect(await reply("r".repeat(1000))).toBe("ok");
    expect(await reply("Hello", "thr_nope")).toBe("THREAD_NOT_FOUND");
    expect(await b.call("sandbox.more.advance", { what: "close-thread", id: "thr_fee" })).toEqual({ ok: true });
    expect(await reply("Hello again")).toBe("THREAD_CLOSED");
    expect((await b.call("bank.messages.get", { threadId: "thr_fee" }))).toMatchObject({ closed: true, status: "Closed" });
    // a reply to the older conversation makes it the latest
    const c = alex();
    await c.call("bank.messages.reply", { threadId: "thr_fee", text: "Thanks" });
    expect(Object.keys(await c.call("bank.messages.list"))).toEqual(["thr_fee", "thr_card"]);
    expect((await c.call("bank.messages.list")).thr_fee.status).toBe("Open");
  });
  it("sending and replying need messages.send, reading does not; a new customer has no conversations", async () => {
    const b = alex({ conditions: { withoutPermissions: ["messages.send"] } });
    expect(await code(b.call("bank.messages.send", { topic: "Account", subject: "Question", text: "Please can you check a payment." }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.messages.reply", { threadId: "thr_fee", text: "Thanks" }))).toBe("PERMISSION_DENIED");
    expect(Object.keys(await b.call("bank.messages.list"))).toHaveLength(2);
    expect(await new MockBank("sam").call("bank.messages.list")).toEqual({});
  });
});

describe("service requests", () => {
  it("lists the requests newest first with their rows, and offers only what is on", async () => {
    const b = alex();
    const list = await b.call("bank.requests.list");
    expect(Object.keys(list)).toEqual(["SR-204118", "SR-203077"]);
    expect(list["SR-204118"]).toMatchObject({ title: "Order cheque book", status: "In progress", line: "28 Oct 2026 · SR-204118", canCancel: false, rank: 1, summary: "Order cheque book" });
    expect(list["SR-204118"].rows).toEqual([{ label: "Account", value: "Main ••4410" }, { label: "Leaves", value: "25" }, { label: "Delivery", value: "Post to your address" }]);
    const o = await b.call("bank.requests.options", { accountId: "acc_save" });
    expect(Object.keys(o.kinds)).toEqual(["cheque", "letter", "lost", "acctype", "other"]);
    expect(o).toMatchObject({ currentType: "Savings", cardJourney: "card-controls", accountCount: 4, firstAccountId: "acc_main" });
    expect(Object.keys(o.changeTo)).toEqual(["Everyday", "Premium"]);
    expect(Object.keys((await b.call("bank.requests.options", { accountId: "acc_main" })).changeTo)).toEqual(["Savings", "Premium"]);
    expect(o.accounts.acc_main.name).toBe("Main ••4410");
    const lean = alex({ config: { disabled: ["card-controls"], options: { "service-request": { cheque: false, acctype: false } } } });
    const l = await lean.call("bank.requests.options", {});
    expect(Object.keys(l.kinds)).toEqual(["letter", "lost", "other"]);
    expect(l.cardJourney).toBe("");
  });
  it("creates each kind with the rows that repeat what was asked, a reference and the status Received", async () => {
    const b = alex();
    expect(await b.call("bank.requests.create", { type: "cheque", accountId: "acc_save", leaves: "50", delivery: "Collect at a branch", branch: "Riverside" })).toMatchObject({ reference: "SR-204119", status: "Received", title: "Order cheque book", account: "Savings ••7731", leaves: "50", delivery: "Collect at Riverside" });
    expect(await b.call("bank.requests.create", { type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Email", addressedTo: "Landlord" })).toMatchObject({ reference: "SR-204120", letter: "Proof of address", delivery: "Email", addressedTo: "Landlord" });
    expect(await b.call("bank.requests.create", { type: "acctype", accountId: "acc_main", changeTo: "Premium", reason: "I travel" })).toMatchObject({ reference: "SR-204121", changeTo: "Premium", account: "Main ••4410" });
    expect(await b.call("bank.requests.create", { type: "other", subject: "Update records", details: "Please update my records." })).toMatchObject({ reference: "SR-204122", subject: "Update records" });
    const list = await b.call("bank.requests.list");
    expect(Object.keys(list)[0]).toBe("SR-204122");
    expect(list["SR-204122"]).toMatchObject({ date: "3 Nov 2026", status: "Received", canCancel: true, rank: 1 });
    expect(list["SR-204121"].rows.map((r: any) => r.value)).toEqual(["Main ••4410", "Premium", "I travel"]);
  });
  it("refuses a second cheque book request for an account that has one open, a lost card, a kind that is off, and fields a screen would not send", async () => {
    const b = alex();
    const create = (input: Record<string, unknown>) => code(b.call("bank.requests.create", input));
    expect(await create({ type: "cheque", accountId: "acc_main", leaves: "25", delivery: "Post to my address" })).toBe("DUPLICATE");
    expect(await create({ type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Post to my address" })).toBe("ok");
    expect(await create({ type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Post to my address" })).toBe("DUPLICATE");
    await b.call("bank.requests.cancel", { requestId: "SR-204119" });
    expect(await create({ type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Post to my address" })).toBe("ok");
    expect(await create({ type: "lost", accountId: "acc_main" })).toBe("USE_CARD_OPTIONS");
    expect(await create({ type: "weather" })).toBe("TYPE_INVALID");
    expect(await create({ type: "cheque", accountId: "acc_nope", leaves: "25", delivery: "Post to my address" })).toBe("ACCOUNT_NOT_FOUND");
    expect(await create({ type: "cheque", accountId: "acc_eur", leaves: "30", delivery: "Post to my address" })).toBe("LEAVES_INVALID");
    expect(await create({ type: "cheque", accountId: "acc_eur", leaves: "25", delivery: "Collect at a branch", branch: "Nowhere" })).toBe("BRANCH_INVALID");
    expect(await create({ type: "letter", accountId: "acc_main", letter: "Birthday card", delivery: "Email" })).toBe("LETTER_INVALID");
    expect(await create({ type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Courier" })).toBe("DELIVERY_INVALID");
    expect(await create({ type: "acctype", accountId: "acc_main", changeTo: "Everyday" })).toBe("SAME_TYPE");
    expect(await create({ type: "acctype", accountId: "acc_save", changeTo: "Savings" })).toBe("SAME_TYPE");
    expect(await create({ type: "other", subject: "ab", details: "Please update my records." })).toBe("SUBJECT_INVALID");
    expect(await create({ type: "other", subject: "Update", details: "short" })).toBe("DETAILS_INVALID");
    const lean = alex({ config: { options: { "service-request": { letter: false } } } });
    expect(await code(lean.call("bank.requests.create", { type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Email" }))).toBe("TYPE_UNAVAILABLE");
  });
  it("cancels a request that is only Received; one that has started, or is finished, cannot be", async () => {
    const b = alex();
    expect(await code(b.call("bank.requests.cancel", { requestId: "SR-204118" }))).toBe("ALREADY_STARTED");
    expect(await code(b.call("bank.requests.cancel", { requestId: "SR-203077" }))).toBe("ALREADY_STARTED");
    expect(await code(b.call("bank.requests.cancel", { requestId: "SR-nope" }))).toBe("REQUEST_NOT_FOUND");
    const { requestId } = await b.call("bank.requests.create", { type: "other", subject: "Update records", details: "Please update my records." });
    expect(await b.call("bank.requests.cancel", { requestId })).toEqual({ status: "Cancelled", requestId });
    expect((await b.call("bank.requests.get", { requestId })).status).toBe("Cancelled");
    expect(await code(b.call("bank.requests.cancel", { requestId }))).toBe("ALREADY_STARTED");
    const c = alex();
    const made = await c.call("bank.requests.create", { type: "other", subject: "Update records", details: "Please update my records." });
    await c.call("sandbox.more.advance", { what: "start-request", id: made.requestId });
    expect(await code(c.call("bank.requests.cancel", { requestId: made.requestId }))).toBe("ALREADY_STARTED");
  });
  it("creating and cancelling need messages.send; seeing needs nothing more", async () => {
    const b = alex({ conditions: { withoutPermissions: ["messages.send"] } });
    expect(await code(b.call("bank.requests.create", { type: "other", subject: "Update records", details: "Please update my records." }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.requests.cancel", { requestId: "SR-204118" }))).toBe("PERMISSION_DENIED");
    expect(Object.keys(await b.call("bank.requests.list"))).toHaveLength(2);
    expect(await new MockBank("sam").call("bank.requests.list")).toEqual({});
  });
});

describe("banks the customer connects", () => {
  const connect = async (b: MockBank, bank: string, picks: Record<string, boolean> = { pick1: true, pick2: true, pick3: true }, extra: Record<string, unknown> = {}) => {
    const s = await b.call("bank.connections.start", { bankId: bank });
    return b.call("bank.connections.finish", { state: s.state, consent: true, ...picks, ...extra });
  };
  it("lists the banks that are not connected and the ones that are, with the end date of the sharing", async () => {
    const b = alex();
    const l = await b.call("bank.connections.banks");
    expect(Object.keys(l.banks)).toEqual(["harbor", "maple", "northern", "summit-bank", "lakeside", "oakridge", "crown", "bayview"]);
    expect(l).toMatchObject({ count: 8, connectedCount: 1, sharingDays: 365, untilText: "3 Nov 2027", market: "A" });
    expect(l.connected).toEqual([{ id: "summit", bank: "Summit Federal", accounts: 1, untilText: "1 Mar 2027", line: "1 account · until 1 Mar 2027" }]);
    expect(await new MockBank("sam").call("bank.connections.banks")).toMatchObject({ connectedCount: 0, count: 8 });
  });
  it("offers the accounts of a bank by its place in the list: one for the first, three for the others, the card only when allowed", async () => {
    const b = alex();
    expect((await b.call("bank.connections.start", { bankId: "harbor" })).accounts).toEqual([{ index: 1, kind: "Current", label: "Current ••1137", balanceText: "$2,410.45" }]);
    const m = await b.call("bank.connections.start", { bankId: "maple" });
    expect(m.accounts.map((a: any) => [a.label, a.balanceText])).toEqual([["Current ••1274", "$2,510.45"], ["Savings ••5422", "$9,620.80"], ["Credit card ••8186", "−$440.15"]]);
    expect([m.label1, m.balance3, m.count]).toEqual(["Current ••1274", "−$440.15", 3]);
    expect(m.redirectUrl).not.toMatch(/password|secret/i);
    const noCards = alex({ config: { options: { "connect-account": { allowCards: false } } } });
    expect((await noCards.call("bank.connections.start", { bankId: "maple" })).accounts.map((a: any) => a.kind)).toEqual(["Current", "Savings"]);
    expect((await b.call("bank.connections.start", { bankId: "maple", allowCards: false })).count).toBe(2);
  });
  it("connects the chosen accounts read only, until the end of the sharing, and writes it to the log and the notices", async () => {
    const b = alex();
    expect(await connect(b, "maple", { pick1: true, pick2: false, pick3: true })).toEqual({ bank: "Maple Credit Union", accounts: 2, until: "2027-11-03", untilText: "3 Nov 2027", days: 365 });
    const linked = await b.call("bank.accounts.linked");
    expect(Object.keys(linked)[0]).toBe("l_maple_current");
    expect(linked.l_maple_current).toMatchObject({ title: "Maple Credit Union Current", line: "At Maple Credit Union (read only)", maskedNumber: "••1274", balanceText: "$2,510.45", readOnly: true, connectedText: "3 Nov 2026", untilText: "3 Nov 2027" });
    expect(linked.l_maple_credit.balanceText).toBe("−$440.15");
    expect(linked.l_maple_savings).toBeUndefined();
    expect(linked.l_summit).toMatchObject({ bank: "Summit Federal", line: "At Summit Federal (read only)", balanceText: "$9,876.54" });
    expect(await b.call("sandbox.more.inspect")).toMatchObject({ log: ["connections.maple.added"], outbox: [] });
    expect((await b.call("bank.notifications.list")).n_more101.text).toBe("Maple Credit Union connected");
    expect(Object.keys((await b.call("bank.connections.banks")).banks)).not.toContain("maple");
    // a connected account is never one to pay from
    expect(Object.keys(await b.call("bank.accounts.list"))).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
    expect((await b.call("bank.accounts.payFrom")).count).toBe(2);
  });
  it("shares for the period of the home market and shows amounts with its symbol", async () => {
    for (const [home, days, symbol, until] of [["uk", 90, "£", "1 Feb 2027"], ["eu", 180, "€", "2 May 2027"], ["ae", 365, "AED ", "3 Nov 2027"], ["us", 365, "$", "3 Nov 2027"]] as const) {
      const b = alex({ config: { homeMarket: home } });
      const r = await connect(b, "maple");
      expect([r.days, r.untilText]).toEqual([days, until]);
      expect((await b.call("bank.accounts.linked")).l_maple_current.balanceText).toBe(`${symbol}2,510.45`);
    }
    expect([SHARING.A.days, SHARING.B.days, SHARING.C.days, SHARING.D.days]).toEqual([365, 90, 180, 365]);
  });
  it("refuses a bank that is not answering, one that is connected, one it does not know, no agreement, no account, and a connection that was not started", async () => {
    const b = alex();
    expect(await code(b.call("bank.connections.start", { bankId: "lakeside" }))).toBe("BANK_UNAVAILABLE");
    expect(await code(b.call("bank.connections.start", { bankId: "nowhere" }))).toBe("BANK_NOT_FOUND");
    const s = await b.call("bank.connections.start", { bankId: "maple" });
    expect(await code(b.call("bank.connections.finish", { state: s.state, pick1: true }))).toBe("CONSENT_REQUIRED");
    expect(await code(b.call("bank.connections.finish", { state: s.state, consent: true }))).toBe("NO_ACCOUNT_CHOSEN");
    expect(await code(b.call("bank.connections.finish", { state: "x", consent: true, pick1: true }))).toBe("STATE_INVALID");
    expect(await code(b.call("bank.connections.finish", { state: s.state, denied: true }))).toBe("ACCESS_DENIED");
    expect(await code(b.call("bank.connections.finish", { state: s.state, consent: true, pick1: true }))).toBe("STATE_INVALID");
    await connect(b, "maple");
    expect(await code(b.call("bank.connections.start", { bankId: "maple" }))).toBe("ALREADY_CONNECTED");
    expect(Object.keys(await b.call("bank.accounts.linked"))).toHaveLength(4);
  });
  it("a second connection to the same bank, started before the first finished, is refused when it finishes", async () => {
    const b = alex();
    const first = await b.call("bank.connections.start", { bankId: "northern" });
    await connect(b, "northern");
    expect(await code(b.call("bank.connections.finish", { state: first.state, consent: true, pick1: true }))).toBe("STATE_INVALID");
  });
  it("disconnects a bank with its accounts, the older one too, and refuses one that is not connected", async () => {
    const b = alex();
    await connect(b, "maple");
    expect(await b.call("bank.connections.remove", { bankId: "maple" })).toEqual({ removed: 3, bank: "Maple Credit Union" });
    expect(Object.keys(await b.call("bank.accounts.linked"))).toEqual(["l_summit"]);
    expect(await b.call("bank.connections.remove", { bankId: "summit" })).toEqual({ removed: 1, bank: "Summit Federal" });
    expect(await b.call("bank.accounts.linked")).toEqual({});
    expect(await code(b.call("bank.connections.remove", { bankId: "summit" }))).toBe("LINK_NOT_FOUND");
    expect(Object.keys((await b.call("bank.connections.banks")).banks)).toContain("maple");
    expect((await b.call("sandbox.more.inspect")).log).toEqual(["connections.maple.added", "connections.maple.removed", "connections.summit.removed"]);
  });
  it("needs accounts.manage, and the dashboard counts what is connected until it is disconnected", async () => {
    const b = alex({ conditions: { withoutPermissions: ["accounts.manage"] } });
    expect(await code(b.call("bank.connections.start", { bankId: "maple" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.connections.remove", { bankId: "summit" }))).toBe("PERMISSION_DENIED");
    expect(Object.keys(await b.call("bank.accounts.linked"))).toEqual(["l_summit"]);
    const c = alex();
    await connect(c, "harbor");
    expect(c.persona.finance!.linked.map((l) => l.id)).toEqual(["l_summit", "l_harbor_current"]);
  });
  it("the older connection by username and password still works for the customers that use it", async () => {
    const b = new MockBank("sam");
    expect(await b.call("bank.accounts.connect", { bankId: "northwind", username: "sam", password: "sandbox1" })).toMatchObject({ bank: "Northwind Bank" });
    expect(Object.keys(await b.call("bank.accounts.linked"))).toEqual(["l_northwind"]);
  });
});

describe("the seeds", () => {
  it("Alex has two conversations and two requests, a new customer none, and every message is data", () => {
    const a = alexMore(), s = emptyMore();
    expect([a.threads.length, a.requests.length, a.pending.length, a.outbox.length, a.log.length]).toEqual([2, 2, 0, 0, 0]);
    expect([s.threads.length, s.requests.length]).toEqual([0, 0]);
    expect(a.threads.flatMap((t) => t.messages).every((m) => typeof m.text === "string" && !/[<>]/.test(m.text))).toBe(true);
  });
});
