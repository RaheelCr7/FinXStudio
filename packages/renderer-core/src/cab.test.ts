import { describe, it, expect } from "vitest";
import { cabJourneys, cabSignIn, cabDefaultSignIn, cabAccountPreview, cabChangeLanguage, cabEnroll, cabActivateProfile, cabCantSignIn, cabLocateUs, cabSupport, type Journey } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";
import { lintAll } from "./lint-expr";

const mk = (j: Journey, persona = "nour", lang?: string) => {
  const bank = new MockBank(persona);
  return { bank, r: new JourneyRunner(j, { adapter: (id, input) => bank.call(id, input), lang }) };
};
const buttonLabels = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "button").map((b) => b.label);
const press = async (r: JourneyRunner, label: string) => {
  const btn = r.view().blocks.find((b) => b.type === "button" && b.label === label);
  if (!btn) throw new Error(`No button "${label}" on ${r.current}. Buttons: ${buttonLabels(r).join(", ")}`);
  await r.press(btn.actions);
};
/** Taps a row of a menu block, as the customer would. */
const menuLabels = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "menu").flatMap((b) => b.items.map((i: any) => i.label));
const tap = async (r: JourneyRunner, label: string) => {
  const item = r.view().blocks.filter((b) => b.type === "menu").flatMap((b) => b.items).find((i: any) => i.label === label);
  if (!item) throw new Error(`No row "${label}" on ${r.current}. Rows: ${menuLabels(r).join(", ")}`);
  await r.press(item.actions);
};
const fill = (r: JourneyRunner, values: Record<string, any>) => { for (const [k, v] of Object.entries(values)) r.set(k, v); };
const alerts = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "alert").map((b) => b.text);
const resultOf = (r: JourneyRunner) => r.view().blocks.find((b) => b.type === "result");

describe("the Cairo Amman Bank journeys", () => {
  it("are all valid, in English and Arabic, and only for the cab project", () => {
    expect(cabJourneys.map((j) => j.slug)).toEqual(["sign-in", "default-sign-in", "account-preview", "change-language", "enroll", "activate-profile", "cant-sign-in", "locate-us", "support"]);
    for (const j of cabJourneys) {
      expect(lintAll(j), j.slug).toEqual([]);
      expect(j.apps).toEqual(["cab"]);
      expect(j.locale).toEqual({ default: "en", supported: ["en", "ar"], rtl: ["ar"] });
    }
  });
  it("read right to left in Arabic", async () => {
    const { r } = mk(cabSignIn, "nour", "ar"); await r.start();
    expect(r.isRtl).toBe(true);
    expect(r.view().title).toBe("مرحباً");
  });
});

describe("Sign in", () => {
  const login = async (persona: string, username: string, password: string) => {
    const { r } = mk(cabSignIn, persona); await r.start();
    expect(r.view().blocks[0]!.type).toBe("hero");
    expect(menuLabels(r)).toEqual(["Explore products", "Resume Application", "Existing user login"]);
    await tap(r, "Existing user login");
    expect(r.current).toBe("login");
    fill(r, { "login.username": username, "login.password": password });
    await press(r, "Sign In");
    return r;
  };
  it("signs in and greets the customer", async () => {
    const r = await login("nour", "nour", "Cab@Secure123");
    expect(r.current).toBe("signed-in");
    expect(resultOf(r)).toMatchObject({ tone: "success", title: "Welcome back, Nour" });
    expect(resultOf(r)!.text).toContain("3 accounts");
  });
  it("needs both fields before it asks the bank", async () => {
    const { r } = mk(cabSignIn); await r.start(); await tap(r, "Existing user login");
    await press(r, "Sign In");
    expect(r.current).toBe("login");
    expect(r.errors["login.username"]).toBeTruthy();
  });
  it("tells the customer how many attempts are left, then locks the profile on the third mistake", async () => {
    const r = await login("nour", "nour", "wrong");
    expect(r.current).toBe("login");
    expect(alerts(r)[0]).toContain("2 attempt(s) left");
    await press(r, "Sign In");
    expect(alerts(r)[0]).toContain("1 attempt(s) left");
    await press(r, "Sign In");
    expect(r.current).toBe("locked");
    expect(resultOf(r)).toMatchObject({ tone: "error", title: "Your profile is locked" });
    expect(resultOf(r)!.text).toContain("30 minutes");
  });
  it("sends a locked, expired or not-yet-active profile to its own screen", async () => {
    expect((await login("lina", "lina", "Cab@Secure123")).current).toBe("locked");
    expect((await login("omar", "omar", "Cab@Secure123")).current).toBe("expired");
    expect((await login("yasmin", "yasmin", "whatever")).current).toBe("inactive");
  });
  it("keeps Explore products and Resume application out of sign in", async () => {
    const { r } = mk(cabSignIn); await r.start();
    await tap(r, "Explore products");
    expect(r.current).toBe("fullapp");
  });
  it("offers the language list from the welcome row, and Can't Sign In from the sign-in screen, and shortcuts at the foot", async () => {
    const { r, bank } = mk(cabSignIn); await r.start();
    expect(r.view().blocks.at(-1)).toMatchObject({ type: "shortcuts" });
    expect(r.view().blocks.find((b) => b.type === "shortcuts")!.items.map((i: any) => [i.label, i.icon])).toEqual([["Enroll/Activate", "userPlus"], ["Locate us", "mapPin"], ["Support", "send"]]);
    await r.press(r.view().blocks.find((b) => b.type === "sectionHeader")!.action.actions);
    expect(r.current).toBe("language");
    r.set("language.code", "ar_AE"); await press(r, "Update Language"); await press(r, "Yes");
    expect(r.current).toBe("login");
    expect((await bank.call("cab.language.current")).current).toBe("ar_AE");
    const link = r.view().blocks.find((b) => b.type === "toggle")!.link;
    expect(link.label).toBe("Can't Sign In?");
    await r.press(link.actions);
    expect(r.current).toBe("cant");
  });
});

describe("Default sign in", () => {
  const start = async () => { const x = mk(cabDefaultSignIn); await x.r.start(); return x; };
  it("sets a PIN: six digits, entered twice, then saved on the device", async () => {
    const { r, bank } = await start();
    expect((r.view().blocks.find((b) => b.type === "select")!.items).map((i: any) => i.id)).toEqual(["password", "biometric", "pin"]);
    expect(r.view().blocks.find((b) => b.type === "select")).toMatchObject({ variant: "rows" });
    expect(r.get("signin.mode")).toBe("password"); // opens with the current default ticked
    r.set("signin.mode", "pin"); await press(r, "Continue");
    expect(r.current).toBe("pin-new");
    expect(r.view().blocks.find((b) => b.type === "otp")).toMatchObject({ keypad: true, masked: true, length: 6 });
    r.set("pin.value", "12"); await press(r, "Continue");
    expect(r.current).toBe("pin-new"); // too short
    r.set("pin.value", "482910"); await press(r, "Continue");
    expect(r.current).toBe("pin-confirm");
    r.set("pin.confirm", "482911"); await press(r, "Continue");
    expect(r.current).toBe("pin-confirm");
    expect(alerts(r)[0]).toContain("do not match");
    r.set("pin.confirm", "482910"); await press(r, "Continue");
    expect(r.current).toBe("pin-intro");
    await press(r, "Set as default");
    expect(r.current).toBe("done");
    expect(r.view().blocks.find((b) => b.type === "alert")!.text).toBe("You have successfully set below Sign In method as default Sign In");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows).toEqual([{ label: "PIN SIGN IN", value: "Generated" }]);
    expect(r.view().blocks.find((b) => b.type === "sectionHeader")!.action.label).toBe("Change");
    expect(await bank.call("cab.device.options")).toMatchObject({ default: "pin", pinSet: true });
  });
  it("sets biometric and password as the default", async () => {
    const a = await start(); a.r.set("signin.mode", "biometric"); await press(a.r, "Continue"); await press(a.r, "Set as default");
    expect(a.r.current).toBe("done"); expect(await a.bank.call("cab.device.options")).toMatchObject({ default: "biometric" });
    const b = await start(); b.r.set("signin.mode", "password"); await press(b.r, "Continue"); await press(b.r, "Set as default");
    expect(await b.bank.call("cab.device.options")).toMatchObject({ default: "password" });
  });
  it("shows the status words under each way, and Change goes back to the list with the new default ticked", async () => {
    const { r } = await start();
    const words = () => r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => [i.id, i.sub ?? ""]);
    expect(words()).toEqual([["password", "Default sign in"], ["biometric", "Enabled"], ["pin", ""]]);
    r.set("signin.mode", "pin"); await press(r, "Continue");
    r.set("pin.value", "482910"); await press(r, "Continue"); r.set("pin.confirm", "482910"); await press(r, "Continue");
    await press(r, "Set as default"); expect(r.current).toBe("done");
    await r.press(r.view().blocks.find((b) => b.type === "sectionHeader")!.action.actions);
    expect(r.current).toBe("choose");
    expect(r.get("signin.mode")).toBe("pin");
    expect(words()).toEqual([["password", ""], ["biometric", "Enabled"], ["pin", "Default sign in"]]);
  });
});

describe("Account preview", () => {
  it("turns the preview on and shows the balances the sign-in screen would show", async () => {
    const { r, bank } = mk(cabAccountPreview); await r.start();
    r.set("preview.enabled", true); await press(r, "Save");
    expect(r.current).toBe("saved");
    expect(resultOf(r)).toBeUndefined(); // the design shows the list, not a banner
    const head = r.view().blocks.find((b) => b.type === "sectionHeader")!;
    expect(head.title).toBe("Account Preview");
    expect(head.subtitle).toMatch(/^As of \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/);
    const rows = r.view().blocks.find((b) => b.type === "balanceList")!.rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ id: "cab_cur", title: "Kmart Corporation...0375", tag: "Current Account", amount: "JOD 2,173.420", caption: "Available balance" });
    expect(rows[1]).toMatchObject({ tag: "Savings Account", amount: "-JOD 3,085.310", caption: "Overdrawn" });
    expect((await bank.call("cab.preview.get")).enabled).toBe(true);
  });
  it("hides the balances when it is off", async () => {
    const { r } = mk(cabAccountPreview); await r.start();
    r.set("preview.enabled", false); await press(r, "Save");
    expect(resultOf(r)!.title).toBe("Account preview is off");
    expect(r.view().blocks.some((b) => b.type === "balanceList")).toBe(false);
  });
});

describe("Change language", () => {
  it("opens with the language in use ticked, asks to confirm by name, then changes it and ends back on sign in", async () => {
    const { r, bank } = mk(cabChangeLanguage); await r.start();
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => i.name)).toEqual(["US English", "UK English", "French", "Arabic"]);
    expect(r.get("language.code")).toBe("en_US"); // the design opens with the current language selected
    r.set("language.code", "ar_AE"); await press(r, "Update Language");
    expect(r.current).toBe("confirm");
    expect(r.view().blocks.find((b) => b.type === "text")!.text).toBe("Are you sure you want to change your language setting to Arabic?");
    expect(r.view().blocks.filter((b) => b.type === "button").map((b) => b.label)).toEqual(["No", "Yes"]); // No on the left, Yes on the right
    await press(r, "No"); expect(r.current).toBe("choose");
    expect(r.get("language.code")).toBe("ar_AE"); // the choice is kept
    await press(r, "Update Language"); await press(r, "Yes");
    expect(r.view().exited).toBe(true); // no "Language updated" screen: the app is back on sign in
    expect((await bank.call("cab.language.current")).current).toBe("ar_AE");
  });
  it("opens on the language that is already in use", async () => {
    const { r, bank } = mk(cabChangeLanguage); await bank.call("cab.language.set", { code: "fr_FR" });
    await r.start();
    expect(r.get("language.code")).toBe("fr_FR");
  });
});

describe("Enroll", () => {
  const upTo = async (persona: string, over: Record<string, string> = {}) => {
    const { r, bank } = mk(cabEnroll, persona); await r.start();
    expect(menuLabels(r)).toEqual(["Enroll your account", "Activate your account"]);
    await tap(r, "Enroll your account");
    fill(r, { "enroll.entity": "mb" }); await press(r, "Continue");
    expect(r.current).toBe("option");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows).toEqual([{ label: "Selected Entity", value: "Model Bank" }]);
    await tap(r, "Personal Banking");
    expect(r.current).toBe("last-name");
    fill(r, { "enroll.lastName": over.lastName ?? "Hegazy" }); await press(r, "Continue");
    fill(r, { "enroll.nationalId": over.nationalId ?? "194324" }); await press(r, "Continue");
    fill(r, { "enroll.dob": over.dob ?? "01 / 01 / 2001" }); await press(r, "Continue");
    expect(r.current).toBe("verify");
    return { r, bank };
  };
  it("enrols a new customer from the details in the design and says where the code went", async () => {
    const { r } = await upTo("sara");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows[0]).toEqual({ label: "Last name", value: "Hegazy" });
    r.set("enroll.captcha", r.get("captcha.text")); await press(r, "Continue");
    expect(r.current).toBe("enrolled");
    expect(resultOf(r)!.title).toBe("You have successfully enrolled to retail banking");
    expect(resultOf(r)!.text).toMatch(/s•••@cab\.com/);
  });
  it("keeps the customer on the screen when the picture code is wrong", async () => {
    const { r } = await upTo("sara");
    r.set("enroll.captcha", "nope"); await press(r, "Continue");
    expect(r.current).toBe("verify");
    expect(alerts(r).some((t) => String(t).includes("doesn't match"))).toBe(true);
  });
  it("explains when the details are not in the bank's records, or the customer is already enrolled", async () => {
    const a = await upTo("sara", { lastName: "Someone" }); a.r.set("enroll.captcha", a.r.get("captcha.text")); await press(a.r, "Continue");
    expect(a.r.current).toBe("cant-enroll");
    const b = await upTo("nour", { lastName: "Haddad", nationalId: "199012" }); b.r.set("enroll.captcha", b.r.get("captcha.text")); await press(b.r, "Continue");
    expect(b.r.current).toBe("welcome-back");
  });
  it("sends business banking and activation to their own screens", async () => {
    const { r } = mk(cabEnroll, "sara"); await r.start();
    await tap(r, "Activate your account"); expect(r.current).toBe("to-activate");
    const b = mk(cabEnroll, "sara"); await b.r.start(); await tap(b.r, "Enroll your account");
    fill(b.r, { "enroll.entity": "mb" }); await press(b.r, "Continue");
    await tap(b.r, "Business Banking");
    expect(b.r.current).toBe("business");
  });
  it("checks the date format before going on", async () => {
    const { r } = mk(cabEnroll, "sara"); await r.start(); await tap(r, "Enroll your account");
    fill(r, { "enroll.entity": "mb" }); await press(r, "Continue"); await tap(r, "Personal Banking");
    fill(r, { "enroll.lastName": "Hegazy", "enroll.nationalId": "194324" });
    await press(r, "Continue"); await press(r, "Continue");
    expect(r.current).toBe("dob");
    r.set("enroll.dob", "1/1/01"); await press(r, "Continue");
    expect(r.current).toBe("dob");
  });
});

describe("Activate your profile", () => {
  const verified = async () => {
    const x = mk(cabActivateProfile, "yasmin"); await x.r.start();
    fill(x.r, { "activate.username": "yasmin", "activate.code": "ACT-4821" }); await press(x.r, "Verify");
    return x;
  };
  it("verifies the code, creates the password and activates the profile", async () => {
    const { r, bank } = await verified();
    expect(r.current).toBe("create-password");
    expect(r.get("policy")).toMatchObject({ minLength: 8, differentChars: 5, maxLength: 100 });
    expect(r.view().blocks.some((b) => b.type === "text" && String(b.text).includes("Password must contain at least 8 characters"))).toBe(true);
    fill(r, { "activate.password": "short", "activate.confirm": "short" }); await press(r, "Create password");
    expect(r.current).toBe("create-password");
    expect(alerts(r)[0]).toContain("security requirements");
    fill(r, { "activate.password": "Fresh#Pass1", "activate.confirm": "Fresh#Pass2" }); await press(r, "Create password");
    expect(alerts(r)[0]).toContain("don't match");
    fill(r, { "activate.confirm": "Fresh#Pass1" }); await press(r, "Create password");
    expect(r.current).toBe("activated");
    expect(resultOf(r)!.title).toBe("Activated successfully");
    expect(await bank.call("cab.auth.signIn", { username: "yasmin", password: "Fresh#Pass1" })).toMatchObject({ ok: true });
  });
  it("counts wrong codes, then blocks the code on the third", async () => {
    const { r } = mk(cabActivateProfile, "yasmin"); await r.start();
    fill(r, { "activate.username": "yasmin", "activate.code": "nope" });
    await press(r, "Verify"); expect(r.current).toBe("credentials"); expect(alerts(r).some((t) => String(t).includes("2 attempt(s) left"))).toBe(true);
    await press(r, "Verify"); await press(r, "Verify");
    expect(r.current).toBe("blocked");
    expect(resultOf(r)!.title).toBe("Your activation code is blocked");
  });
});

describe("Can't sign in", () => {
  const found = async (persona = "nour", over: Record<string, string> = {}) => {
    const x = mk(cabCantSignIn, persona); const { r } = x; await r.start();
    fill(r, { "recover.entity": "mb" }); await press(r, "Continue");
    expect(r.current).toBe("email");
    fill(r, { "recover.email": over.email ?? "jeyose8168@cab.com", "recover.captcha": over.captcha ?? r.get("captcha.text") }); await press(r, "Continue");
    return x;
  };
  const toDob = async (x: Awaited<ReturnType<typeof found>>, phone = "34 56 78 90", dob = "01 / 01 / 2001") => {
    fill(x.r, { "recover.phone": phone }); await press(x.r, "Continue");
    fill(x.r, { "recover.dob": dob }); await press(x.r, "Continue");
  };
  it("finds the customer, sends a code, accepts it and sets a new password the customer can sign in with", async () => {
    const x = await found(); expect(x.r.current).toBe("phone");
    await toDob(x);
    expect(x.r.current).toBe("found");
    expect(x.r.view().blocks.find((b) => b.type === "text" && String(b.text).startsWith("Welcome back"))!.text).toBe("Welcome back, Nour!");
    expect(x.r.view().blocks.some((b) => b.type === "text" && String(b.text).includes("username: nour"))).toBe(true);
    expect(menuLabels(x.r)).toEqual(["Sign in as nour", "Reset your password"]);
    expect(x.r.view().blocks.filter((b) => b.type === "divider").map((b) => b.label)).toEqual(["OR"]);
    await tap(x.r, "Reset your password");
    x.r.set("recover.channel", "sms"); await press(x.r, "Send code");
    expect(x.r.current).toBe("otp");
    x.r.set("otp.code", "482100"); await press(x.r, "Verify");
    expect(x.r.current).toBe("new-password");
    fill(x.r, { "recover.password": "Brand#New42", "recover.confirm": "Brand#New42" }); await press(x.r, "Continue");
    expect(x.r.current).toBe("reset-done");
    expect(resultOf(x.r)!.title).toBe("Your password has been successfully updated");
    expect(await x.bank.call("cab.auth.signIn", { username: "nour", password: "Brand#New42" })).toMatchObject({ ok: true });
  });
  it("stays on the email screen when the picture code is wrong", async () => {
    const x = await found("nour", { captcha: "nope" });
    expect(x.r.current).toBe("email");
    expect(alerts(x.r)[0]).toContain("Wrong code");
  });
  it("says no profile matches, without saying which detail was wrong", async () => {
    const x = await found(); await toDob(x, "99 99 99 99");
    expect(x.r.current).toBe("not-found");
  });
  it("locks after three wrong security codes", async () => {
    const x = await found(); await toDob(x); await tap(x.r, "Reset your password");
    x.r.set("recover.channel", "email"); await press(x.r, "Send code");
    x.r.set("otp.code", "000111");
    await press(x.r, "Verify"); expect(x.r.current).toBe("otp");
    await press(x.r, "Verify"); await press(x.r, "Verify");
    expect(x.r.current).toBe("otp-locked");
  });
  it("offers a new activation code instead of a password reset when the profile was never activated", async () => {
    const x = mk(cabCantSignIn, "yasmin"); const { r } = x; await r.start();
    fill(r, { "recover.entity": "mb" }); await press(r, "Continue");
    fill(r, { "recover.email": "yasmin.khoury@cab.com", "recover.captcha": r.get("captcha.text") }); await press(r, "Continue");
    await toDob(x, "79 333 0172", "09 / 08 / 1997");
    expect(r.current).toBe("found");
    expect(menuLabels(r)).toEqual(["Send me a new activation code"]);
    await tap(r, "Send me a new activation code");
    expect(r.current).toBe("regenerated");
  });
});

describe("Locate us", () => {
  it("searches by kind and range and shows the details of one location", async () => {
    const { r } = mk(cabLocateUs); await r.start();
    expect(r.get("loc.kind")).toBe("branch"); // the design opens on Branches
    r.set("loc.kind", "all"); r.set("loc.range", "100"); await press(r, "Search");
    expect(r.current).toBe("results");
    expect(r.view().blocks.find((b) => b.type === "text")!.text).toBe("5 location(s) found");
    r.set("loc.selected", "loc_abdoun"); await press(r, "View details");
    expect(r.current).toBe("details");
    const rows = r.view().blocks.find((b) => b.type === "reviewSummary")!.rows;
    expect(rows).toContainEqual({ label: "Status", value: "Open" });
    expect(rows).toContainEqual({ label: "Distance", value: "2.2 km" });
    await press(r, "Call us");
    expect(r.view().toast).toBe("Calling +962 6 5200 000…");
  });
  it("filters to ATMs only and says so when nothing matches", async () => {
    const { r } = mk(cabLocateUs); await r.start();
    r.set("loc.kind", "atm"); await press(r, "Search");
    expect(r.view().blocks.find((b) => b.type === "text")!.text).toBe("1 location(s) found");
    await press(r, "Change filters");
    r.set("loc.query", "zzz"); await press(r, "Search");
    expect(r.current).toBe("none");
  });
});

describe("Support", () => {
  it("shows the FAQs as one accordion screen of six topics, with questions and answers inside", async () => {
    const { r } = mk(cabSupport); await r.start();
    await tap(r, "FAQs");
    expect(r.current).toBe("faqs");
    const acc = r.view().blocks.find((b) => b.type === "accordion")!;
    expect(acc.items.map((i: any) => i.title)).toEqual(["Account Activity", "Alerts & Communication", "Bill Payments", "Cards", "Person-To-Person", "Profile Management"]);
    expect(acc.items[0].text).toContain("Which account types are listed");
    expect(acc.items[3].text).toContain("How do I freeze my card?\nOpen the card in the app");
  });
  it("reaches terms, privacy and the phone number", async () => {
    for (const [label, screen] of [["Terms & Conditions", "terms"], ["Privacy Policy", "privacy"]] as const) {
      const { r } = mk(cabSupport); await r.start();
      await tap(r, label);
      expect(r.current).toBe(screen);
    }
    const { r } = mk(cabSupport); await r.start(); await press(r, "Call Us");
    expect(resultOf(r)!.title).toBe("+96112025050");
  });
});
