import type { Journey } from "../schema";

/** What must be true for "Sign in" to be right. Each is proved by at least one scenario below. */
export const signInAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A correct username and password on a device the customer trusts signs in without a code, the bank then serves that customer, and the result says \"Password on a known device\"." },
  { id: "AC-2", text: "A new device, or an unusual sign-in while the bank's option riskStepUp is on, needs a 6-digit code before anything else happens; a trusted device and quick mode skip it." },
  { id: "AC-3", text: "A wrong password and an unknown username give the same message; the attempts-left notice shows from the third wrong password, and the fifth locks sign-in; four wrong ones followed by the right one still signs in." },
  { id: "AC-4", text: "A locked username cannot continue and is offered \"Unlock my account\" (or \"Reset password\" when the bank switched unlocking off) and \"Call us instead\"; a profile that is not active cannot sign in." },
  { id: "AC-5", text: "A wrong code gives the wrong-code message and counts toward the five that lock sign-in; a code over five minutes old, or the expired test code, says so; a new code makes the old one useless; at most 3 resends." },
  { id: "AC-6", text: "Text message is offered only while allowSms is on; \"Another signed-in device\" is always offered." },
  { id: "AC-7", text: "A first sign-in with a temporary password, or an expired password while forceExpiry is on, shows \"Choose a new password\" after the code step; a normal password never shows it; with forceExpiry off an expired password signs in." },
  { id: "AC-8", text: "The new password is refused for its length, the username, a common word, a known breach and an earlier use, each with its own message; the two entries must match; afterwards the new password signs in and the old one does not." },
  { id: "AC-9", text: "\"Trust this device\" asks for a name and skips the code for 90 days (not after); \"Don’t trust\" asks for a code every time; at most 5 devices are trusted." },
  { id: "AC-10", text: "Quick sign-in choices show only the methods the bank offers and the device supports, plus \"Not now\"; a quick PIN must be 6 digits, not weak, not part of the phone number, and entered twice." },
  { id: "AC-11", text: "With quick sign-in set up and a remembered username the screen offers \"Welcome back\" with one button and signs in without the password or a code; a wrong quick PIN says \"That PIN isn’t right.\", three turn quick sign-in off, and wrong PINs share the lock of wrong passwords." },
  { id: "AC-12", text: "With rememberUser off there is no checkbox and the username is not remembered on the device; with it on, the username is remembered." },
  { id: "AC-13", text: "The result lists how the person signed in, whether the device is trusted, the quick sign-in method and whether the password changed." },
  { id: "AC-14", text: "When the bank is unavailable or times out nothing is changed and no wrong try is counted; the person can try again." },
  { id: "AC-15", text: "The journey never keeps the password, the new password or a PIN: each is cleared as soon as the bank has it, also when the bank did not answer." },
  { id: "AC-16", text: "Opened from the session timeout it says the person was signed out for their security; \"Forgot password?\" and \"Forgot username?\" open those journeys, and a recovered username or an unlock comes back here." },
];

// The sandbox bank: alex.morgan has the password below and three trusted devices (iPhone 15 is the one a "known" device means), sam.rivera has none,
// demo.locked is locked, demo.expired has an expired password, demo.inactive is not active, new.user has a temporary password and
// device.limit already trusts five devices. The one-time code is 482100 (000000 is wrong, 999999 is expired). Today is Tuesday 3 November 2026.
const NOW = "2026-11-03T10:00:00Z";
const PW = "Bwx!Demo2026";
const NEW_PW = "Granite-Lemon-92-River";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const inspect = (user: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: user }, path, equals } });
const bank = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
/** The password a scenario knows is in a screen's field: it must not be there once the bank has it. */
const login = (user = "alex.morgan", pw = PW): Step[] => [set({ "login.username": user, "login.password": pw }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "login.code": c }), press("Continue")];
const base = { persona: "signed-out", now: NOW };
const known = { device: "known" as const };
const fresh = { device: "new" as const };
const WRONG = "The username or password isn’t right. Check them and try again.";
/** A new device through the code, to "Trust this device?". */
const toTrust: Step[] = [...login(), screen("code"), ...code(), screen("trust")];
/** Trusting the device under a name, to the quick sign-in offer. */
const trustIt = (name = "My phone"): Step[] => [set({ "login.trust": "trust", "login.deviceName": name }), press("Continue")];
/** Alex's quick PIN, set up on the known device and remembered, before the walk: the sign-in then opens the way a returning customer sees it. */
const quickSetup: NonNullable<Journey["scenarios"]>[number]["setup"] = [
  { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW } },
  { adapter: "bank.auth.setQuickSignIn", input: { method: "pin", pin: "504719" } },
  { adapter: "bank.auth.completeSignIn", input: { remember: true } },
];
const OFF = { "opt.allowBio": false, "opt.allowPasskey": false, "opt.allowQuickPin": false };
const unavailable = (...a: string[]) => ({ unavailable: a });
const SORRY = "We couldn’t reach the bank. Nothing was changed.";
const SLOW = "This is taking longer than expected. Nothing was changed.";

export const signInScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A trusted device: password only, then the offer of quick sign-in, and Signed in with \"Password on a known device\"; the bank now serves Alex", covers: ["AC-1", "AC-13"], ...base, conditions: known,
    steps: [
      screen("credentials"), text("Welcome"), text("Use your BankWorkx® username and password."), text("Remember my username on this device"), ...login(), screen("quick"), noText("Enter your code"), press("Not now"),
      screen("signedIn"), text("Signed in"), text("Welcome, Alex."), text("alex.morgan"), text("Password on a known device"), text("Trusted for"), text("Quick sign-in"), text("Unchanged"), text("Ends after 5 minutes without use"), text("Last sign-in: San Francisco, US"),
      inspect("alex.morgan", "sessionOpen", true), bank("bank.session.get", {}, "identity.id", "alex"), bank("bank.accounts.list", {}, "acc_main.name", "Main"),
    ],
  },
  {
    id: "T-2", name: "A new device asks for a 6-digit code before anything else; 000000 is wrong and counts, 999999 has expired, the right code goes on to \"Trust this device?\"", covers: ["AC-2", "AC-5"], ...base, conditions: fresh,
    steps: [
      ...login(), screen("code"), text("This looks like a new device, so we need one more check."), text("It works for 5 minutes and only once."), text("BankWorkx® will never call or message you"), noText("Choose a new password"),
      ...code("000000"), screen("code"), text("That code isn’t right. Check the latest message and try again."), text("4 attempts left."),
      ...code("999999"), text("That code has expired. Ask for a new one."),
      ...code("482100"), screen("trust"), text("Trust this device?"),
    ],
  },
  {
    id: "T-3", name: "An unusual sign-in on a trusted device asks for a code while riskStepUp is on, and does not when the bank switched it off", covers: ["AC-2"], ...base, conditions: { device: "unusual" },
    steps: [...login(), screen("code"), text("This looks like a new device")],
  },
  {
    id: "T-4", name: "With the option riskStepUp off an unusual sign-in on a trusted device asks for no code", covers: ["AC-2"], ...base, conditions: { device: "unusual" }, config: { options: { "sign-in": { riskStepUp: false } } },
    steps: [...login(), screen("quick"), noText("Enter your code")],
  },
  {
    id: "T-5", name: "The code can be sent by text message or to another signed-in device; the text message shows the masked phone", covers: ["AC-5", "AC-6"], ...base, conditions: fresh,
    steps: [
      ...login(), screen("code"), text("Text message"), text("Another signed-in device"), text("Approve in the BankWorkx® app"), noText("Code sent by text message"),
      set({ "login.channel": "sms" }), press("Send me a new code"), text("Code sent by text message"), text("+1 ••• ••• 0142"), noText("Approve in the BankWorkx® app"),
    ],
  },
  {
    id: "T-6", name: "With allowSms off only \"Another signed-in device\" is offered", covers: ["AC-6"], ...base, conditions: fresh, launch: { "opt.allowSms": false },
    steps: [...login(), screen("code"), text("Another signed-in device"), noText("Text message")],
  },
  {
    id: "T-7", name: "A wrong password: the same message for a wrong password and an unknown username, the notice from the third, the password field emptied each time", covers: ["AC-3", "AC-15"], ...base, conditions: known,
    steps: [
      ...login("alex.morgan", "wrong-password-1"), screen("credentials"), text(WRONG), noText("attempts left"), noText("wrong-password-1"),
      ...login("nobody", "wrong-password-2"), text(WRONG), noText("attempts left"), noText("wrong-password-2"),
      ...login("alex.morgan", "wrong-password-3"), text(WRONG), noText("attempts left"),
      ...login("alex.morgan", "wrong-password-4"), text(WRONG), text("2 attempts left. After that, we lock sign-in to protect your account."),
      ...login("alex.morgan", "wrong-password-5"), text("1 attempt left."), inspect("alex.morgan", "failedSignIns", 4), inspect("alex.morgan", "locked", false),
    ],
  },
  {
    id: "T-8", name: "The fifth wrong password locks sign-in and shows the unlock card; the right password no longer helps, and the bank says locked", covers: ["AC-3", "AC-4"], ...base, conditions: known,
    steps: [
      ...login("alex.morgan", "wrong-1"), ...login("alex.morgan", "wrong-2"), ...login("alex.morgan", "wrong-3"), ...login("alex.morgan", "wrong-4"), screen("credentials"),
      ...login("alex.morgan", "wrong-5"), screen("locked"), text("Sign-in is locked"), text("Too many wrong attempts. This protects your money."), text("Unlock your account"), text("Unlock my account"), text("Call us instead"), noText("Continue"),
      inspect("alex.morgan", "locked", true), bank("bank.auth.signIn", { username: "alex.morgan", password: PW }, "code", "LOCKED"),
    ],
  },
  {
    id: "T-9", name: "Four wrong passwords do not lock: the right one still signs in and sets the count back to zero", covers: ["AC-3"], ...base, conditions: known,
    steps: [
      ...login("alex.morgan", "wrong-1"), ...login("alex.morgan", "wrong-2"), ...login("alex.morgan", "wrong-3"), ...login("alex.morgan", "wrong-4"),
      ...login(), screen("quick"), inspect("alex.morgan", "failedSignIns", 0), press("Not now"), screen("signedIn"),
    ],
  },
  {
    id: "T-10", name: "A username that does not exist is locked the same way after five tries, so the screen never says whether a username exists", covers: ["AC-3"], ...base, conditions: known,
    steps: [...login("nobody", "x-1"), ...login("nobody", "x-2"), ...login("nobody", "x-3"), ...login("nobody", "x-4"), ...login("nobody", "x-5"), screen("locked"), text("Sign-in is locked")],
  },
  {
    id: "T-11", name: "A locked profile cannot continue: \"Call us instead\" shows the number, \"Unlock my account\" opens unlock-account with the username", covers: ["AC-4", "AC-16"], ...base, conditions: known,
    steps: [
      ...login("demo.locked"), screen("locked"), text("Unlock my account"), text("Call us instead"), noText("Reset password"), press("Call us instead"), text("Call us on +1 800 555 0100 (sandbox number)."),
      press("Unlock my account"), { expectOpens: { journey: "reset-password", with: { "launch.mode": "unlock", "launch.user": "demo.locked" } } }, screen("ident"), text("Unlock your account"), text("demo.locked"),
    ],
  },
  {
    id: "T-12", name: "With unlocking switched off the locked card offers \"Reset password\" and no \"Unlock my account\"", covers: ["AC-4", "AC-16"], ...base, conditions: known, launch: { "opt.allowUnlock": false },
    steps: [
      ...login("demo.locked"), screen("locked"), noText("Unlock my account"), noText("Unlock your account"), text("Reset password"), text("Call us instead"),
      press("Reset password"), { expectOpens: { journey: "reset-password", with: { "launch.mode": "reset", "launch.user": "demo.locked" } } }, screen("ident"), text("Reset your password"),
    ],
  },
  {
    id: "T-13", name: "A profile that is not active cannot sign in", covers: ["AC-4"], ...base, conditions: known,
    steps: [...login("demo.inactive"), screen("inactive"), text("Your profile isn’t active yet"), noText("Continue")],
  },
  {
    id: "T-14", name: "The username and the password are checked before anything is sent", covers: ["AC-3"], ...base, conditions: known,
    steps: [
      press("Continue"), screen("credentials"), error("login.username"), error("login.password"),
      set({ "login.username": "ab", "login.password": "x" }), press("Continue"), error("Usernames have 3 to 40 letters, numbers, dots, dashes or underscores."), inspect("alex.morgan", "failedSignIns", 0),
    ],
  },
  {
    id: "T-15", name: "A new code makes the old one useless; a fourth resend is refused", covers: ["AC-5"], ...base, conditions: fresh,
    steps: [
      ...login(), screen("code"), press("Send me a new code"), { expectToast: "New code sent. The old code no longer works." }, ...code("482100"), text("That code isn’t right. Check the latest message and try again."),
      press("Send me a new code"), press("Send me a new code"), noText("You have asked for the maximum number"),
      press("Send me a new code"), screen("code"), text("You have asked for the maximum number of codes. Wait 15 minutes or choose another way."),
      ...code("482103"), screen("trust"),
    ],
  },
  {
    id: "T-16", name: "A code older than five minutes has expired", covers: ["AC-5"], ...base, conditions: fresh,
    steps: [...login(), screen("code"), { advance: 301 }, ...code(), text("That code has expired. Ask for a new one."), press("Send me a new code"), ...code("482101"), screen("trust")],
  },
  {
    id: "T-17", name: "Five wrong codes lock sign-in", covers: ["AC-5"], ...base, conditions: fresh,
    steps: [
      ...login(), screen("code"), ...code("111111"), text("4 attempts left."), ...code("111111"), ...code("111111"), text("2 attempts left. After that, sign-in locks."), ...code("111111"), text("1 attempt left."),
      ...code("111111"), screen("locked"), text("Sign-in is locked"), inspect("alex.morgan", "locked", true),
    ],
  },
  {
    id: "T-18", name: "The code is checked before it is sent: empty or short is refused", covers: ["AC-5"], ...base, conditions: fresh,
    steps: [...login(), screen("code"), press("Continue"), error("login.code"), set({ "login.code": "123" }), press("Continue"), error("Enter all 6 digits"), screen("code")],
  },
  {
    id: "T-19", name: "An expired password: after the code, \"Your password has expired\"; each rule has its message; a good phrase goes on", covers: ["AC-7", "AC-8"], ...base, conditions: fresh,
    steps: [
      ...login("demo.expired"), screen("code"), ...code(), screen("newPassword"), text("Choose a new password"), text("Your password has expired"), text("It is more than 12 months old."), noText("Welcome to BankWorkx®"),
      set({ "login.newPassword": "short", "login.confirm": "short" }), press("Continue"), error("Use at least 12 characters. Three or four unrelated words work well."), text("○ At least 12 characters"),
      set({ "login.newPassword": "x".repeat(65), "login.confirm": "x".repeat(65) }), press("Continue"), text("Use 64 characters or fewer."),
      set({ "login.newPassword": "my-demo.expired-pass-1", "login.confirm": "my-demo.expired-pass-1" }), press("Continue"), text("Don’t use your username in your password."),
      set({ "login.newPassword": "Password123!Password", "login.confirm": "Password123!Password" }), press("Continue"), text("That password is too common. Try a longer phrase of unrelated words."),
      set({ "login.newPassword": "Winter2024!Winter", "login.confirm": "Winter2024!Winter" }), press("Continue"), text("This password has appeared in a data breach, so we can’t accept it."),
      set({ "login.newPassword": PW, "login.confirm": PW }), press("Continue"), text("Choose a password you haven’t used here before."),
      set({ "login.newPassword": NEW_PW, "login.confirm": "something else entirely" }), press("Continue"), text("The two passwords don’t match."), noText(NEW_PW), screen("newPassword"),
      set({ "login.newPassword": NEW_PW, "login.confirm": NEW_PW }), text("✓ At least 12 characters"), press("Continue"), screen("trust"),
    ],
  },
  {
    id: "T-20", name: "A temporary password (a first sign-in): \"Welcome to BankWorkx®\" after the code", covers: ["AC-7"], ...base, conditions: fresh,
    steps: [...login("new.user"), ...code(), screen("newPassword"), text("Welcome to BankWorkx®. You signed in with a temporary password. Choose your own to continue."), noText("Your password has expired")],
  },
  {
    id: "T-21", name: "With forceExpiry off an expired password signs in without choosing a new one, and the result says the password is unchanged", covers: ["AC-7", "AC-13"], ...base, conditions: fresh, config: { options: { "sign-in": { forceExpiry: false } } },
    steps: [...login("demo.expired"), ...code(), screen("trust"), noText("Choose a new password"), set({ "login.trust": "public" }), press("Continue"), screen("signedIn"), text("Unchanged")],
  },
  {
    id: "T-22", name: "A normal password never shows \"Choose a new password\"", covers: ["AC-7"], ...base, conditions: fresh,
    steps: [...login("sam.rivera"), ...code(), screen("trust"), noText("Choose a new password"), noText("Your password has expired")],
  },
  {
    id: "T-23", name: "After a new password the result says so, the new password signs in at the bank and the old one does not", covers: ["AC-8", "AC-13"], ...base, conditions: fresh,
    steps: [
      ...login("demo.expired"), ...code(), set({ "login.newPassword": NEW_PW, "login.confirm": NEW_PW }), press("Continue"), screen("trust"), noText(NEW_PW),
      set({ "login.trust": "public" }), press("Continue"), screen("signedIn"), text("Changed just now"), text("Password and one-time code"), text("Not trusted"),
      bank("bank.auth.signIn", { username: "demo.expired", password: NEW_PW }, "ok", true), bank("bank.auth.signIn", { username: "demo.expired", password: PW }, "code", "INVALID_CREDENTIALS"),
    ],
  },
  {
    id: "T-24", name: "Trusting the device needs a name; trusted for 90 days it asks for no code, and after 90 days it asks again", covers: ["AC-9", "AC-13"], ...base, conditions: fresh,
    steps: [
      ...toTrust, set({ "login.trust": "trust" }), press("Continue"), error("login.deviceName"), screen("trust"),
      ...trustIt("My phone"), screen("quick"), press("Not now"), screen("signedIn"), text("Trusted for 90 days"), inspect("alex.morgan", "trustedDevices", ["dev_iphone15", "dev_laptop", "dev_tablet", "dev_new"]),
      bank("bank.auth.signIn", { username: "alex.morgan", password: PW }, "status", "ok"), { advance: 91 * 86400 }, bank("bank.auth.signIn", { username: "alex.morgan", password: PW }, "status", "otp"),
    ],
  },
  {
    id: "T-25", name: "\"Don’t trust\" asks for a code every time and offers no quick sign-in; the device is not kept", covers: ["AC-9", "AC-13"], ...base, conditions: fresh,
    steps: [
      ...toTrust, set({ "login.trust": "public" }), press("Continue"), screen("signedIn"), text("Not trusted"), text("Off"),
      inspect("alex.morgan", "trustedDevices", ["dev_iphone15", "dev_laptop", "dev_tablet"]), bank("bank.auth.signIn", { username: "alex.morgan", password: PW }, "status", "otp"),
    ],
  },
  {
    id: "T-26", name: "At most 5 trusted devices: a sixth is refused with a message and the person can choose not to trust it", covers: ["AC-9"], ...base, conditions: fresh,
    steps: [
      ...login("device.limit"), ...code(), screen("trust"), ...trustIt("Sixth"), screen("trust"), text("You already trust 5 devices."), set({ "login.trust": "public" }), press("Continue"), screen("signedIn"), text("Not trusted"),
    ],
  },
  {
    id: "T-27", name: "Trust is chosen before going on", covers: ["AC-9"], ...base, conditions: fresh,
    steps: [...toTrust, press("Continue"), error("login.trust"), screen("trust")],
  },
  {
    id: "T-28", name: "On an iPhone every quick method the bank offers is shown, plus \"Not now\"; Face ID is turned on and the result shows it", covers: ["AC-10", "AC-13"], ...base, conditions: known,
    steps: [
      ...login(), screen("quick"), text("Sign in faster next time"), text("Face ID or fingerprint"), text("Passkey"), text("6-digit quick PIN"), text("Not now"),
      press("Face ID or fingerprint"), screen("signedIn"), text("Face ID or fingerprint"), inspect("alex.morgan", "quick", { dev_iphone15: "biometric" }),
    ],
  },
  {
    id: "T-29", name: "Only the PIN is offered when the bank switched Face ID and passkeys off", covers: ["AC-10"], ...base, conditions: known, launch: { "opt.allowBio": false, "opt.allowPasskey": false },
    steps: [...login(), screen("quick"), text("6-digit quick PIN"), noText("Face ID or fingerprint"), noText("Passkey"), text("Not now")],
  },
  {
    id: "T-30", name: "Only Face ID is offered when the bank switched passkeys and the PIN off", covers: ["AC-10"], ...base, conditions: known, launch: { "opt.allowPasskey": false, "opt.allowQuickPin": false },
    steps: [...login(), screen("quick"), text("Face ID or fingerprint"), noText("Passkey"), noText("6-digit quick PIN")],
  },
  {
    id: "T-31", name: "A passkey is turned on, and with every method switched off the offer is skipped", covers: ["AC-10", "AC-13"], ...base, conditions: known,
    steps: [...login(), press("Passkey"), screen("signedIn"), text("Passkey"), inspect("alex.morgan", "quick", { dev_iphone15: "passkey" })],
  },
  {
    id: "T-32", name: "With every quick method switched off the offer is skipped", covers: ["AC-10"], ...base, conditions: known, launch: OFF,
    steps: [...login(), screen("signedIn"), noText("Sign in faster next time")],
  },
  {
    id: "T-33", name: "A browser (no fingerprint or face) is offered the passkey and the PIN, not Face ID", covers: ["AC-10"], ...base, conditions: fresh,
    steps: [...toTrust, ...trustIt(), screen("quick"), text("Passkey"), text("6-digit quick PIN"), noText("Face ID or fingerprint")],
  },
  {
    id: "T-34", name: "A quick PIN must be 6 digits, not weak, not part of the phone number, and entered twice; a good one is turned on", covers: ["AC-10", "AC-13", "AC-15"], ...base, conditions: known,
    steps: [
      ...login(), press("6-digit quick PIN"), screen("pin"),
      set({ "login.pin": "12345", "login.pinConfirm": "12345" }), press("Continue"), error("Use exactly 6 digits."),
      set({ "login.pin": "222222", "login.pinConfirm": "222222" }), press("Continue"), screen("pin"), text("That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456."), noText("222222"),
      set({ "login.pin": "123456", "login.pinConfirm": "123456" }), press("Continue"), text("That PIN is too easy to guess."),
      set({ "login.pin": "014204", "login.pinConfirm": "014204" }), press("Continue"), text("Don’t use digits from your phone number."),
      set({ "login.pin": "504719", "login.pinConfirm": "504710" }), press("Continue"), text("The PINs don’t match."), screen("pin"),
      set({ "login.pin": "504719", "login.pinConfirm": "504719" }), press("Continue"), screen("signedIn"), text("Quick PIN"), inspect("alex.morgan", "pinSet", { dev_iphone15: true, dev_laptop: false, dev_tablet: false }),
    ],
  },
  {
    id: "T-35", name: "Welcome back: a remembered username and a quick PIN sign in without the password or a code; the result says Quick PIN", covers: ["AC-11", "AC-13"], ...base, conditions: known, setup: quickSetup,
    steps: [
      screen("credentials"), text("Welcome back, Alex"), text("Use PIN"), text("Sign in with your quick PIN on this device."), text("alex.morgan"),
      press("Use PIN"), text("Quick PIN"), noText("Forgot password?"), set({ "login.quickPin": "504719" }), press("Continue"), screen("signedIn"), text("How"), text("Quick PIN"), noText("Enter your code"), noText("Sign in faster next time"),
    ],
  },
  {
    id: "T-36", name: "A wrong quick PIN says so and stays; three turn quick sign-in off on the device; the password still works", covers: ["AC-11", "AC-15"], ...base, conditions: known, setup: quickSetup,
    steps: [
      press("Use PIN"), set({ "login.quickPin": "111111" }), press("Continue"), text("That PIN isn’t right."), noText("111111"), screen("credentials"),
      set({ "login.quickPin": "222222" }), press("Continue"), text("That PIN isn’t right."),
      set({ "login.quickPin": "333333" }), press("Continue"), text("Quick sign-in is off on this device. Use your password."), noText("Use PIN"), text("Password"),
      bank("bank.device.options", {}, "pinSet", false),
    ],
  },
  {
    id: "T-37", name: "Wrong PINs share the lock of wrong passwords: three wrong PINs and two wrong passwords lock the profile", covers: ["AC-11"], ...base, conditions: known, setup: quickSetup,
    steps: [
      press("Use PIN"), set({ "login.quickPin": "111111" }), press("Continue"), set({ "login.quickPin": "222222" }), press("Continue"), set({ "login.quickPin": "333333" }), press("Continue"),
      ...login("alex.morgan", "wrong-1"), screen("credentials"), ...login("alex.morgan", "wrong-2"), screen("locked"), inspect("alex.morgan", "locked", true),
    ],
  },
  {
    id: "T-38", name: "\"Not Alex?\" clears the greeting and shows the plain form; the device keeps its registration", covers: ["AC-11"], ...base, conditions: known, setup: quickSetup,
    steps: [text("Welcome back, Alex"), press("Not Alex? Sign in with another account"), text("Welcome"), noText("Welcome back, Alex"), noText("Use PIN"), text("Username"), bank("bank.device.options", {}, "pinSet", true)],
  },
  {
    id: "T-39", name: "Face ID on a device that remembers it signs in without the password", covers: ["AC-11", "AC-13"], ...base, conditions: known,
    setup: [
      { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW } }, { adapter: "bank.auth.setQuickSignIn", input: { method: "biometric" } }, { adapter: "bank.auth.completeSignIn", input: { remember: true } },
    ],
    steps: [text("Welcome back, Alex"), press("Use Face ID"), screen("signedIn"), text("Face ID or fingerprint")],
  },
  {
    id: "T-40", name: "A passkey on a device that remembers it signs in without the password", covers: ["AC-11"], ...base, conditions: known,
    setup: [
      { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW } }, { adapter: "bank.auth.setQuickSignIn", input: { method: "passkey" } }, { adapter: "bank.auth.completeSignIn", input: { remember: true } },
    ],
    steps: [text("Welcome back, Alex"), press("Use passkey"), screen("signedIn")],
  },
  {
    id: "T-41", name: "The quick PIN is checked before it is sent: it must be 6 digits", covers: ["AC-11"], ...base, conditions: known, setup: quickSetup,
    steps: [press("Use PIN"), press("Continue"), error("login.quickPin"), set({ "login.quickPin": "123" }), press("Continue"), error("Enter your 6-digit PIN."), screen("credentials"), inspect("alex.morgan", "failedSignIns", 0)],
  },
  {
    id: "T-42", name: "With rememberUser on the checkbox shows and the username is remembered; with it ticked off it is not", covers: ["AC-12"], ...base, conditions: known,
    steps: [
      text("Remember my username on this device"), set({ "login.remember": false }), ...login(), press("Not now"), screen("signedIn"), bank("bank.device.options", {}, "username", ""),
    ],
  },
  {
    id: "T-43", name: "A username ticked to be remembered greets the person next time", covers: ["AC-12"], ...base, conditions: known,
    steps: [...login(), press("Not now"), screen("signedIn"), bank("bank.device.options", {}, "username", "alex.morgan"), bank("bank.device.options", {}, "firstName", "Alex")],
  },
  {
    id: "T-44", name: "With rememberUser off there is no checkbox and nothing is remembered", covers: ["AC-12"], ...base, conditions: known, launch: { ...OFF, "opt.rememberUser": false },
    steps: [noText("Remember my username"), ...login(), screen("signedIn"), bank("bank.device.options", {}, "username", "")],
  },
  {
    id: "T-45", name: "Everything on the way: expired password, code, new password, trust, PIN; the result lists each", covers: ["AC-13"], ...base, conditions: fresh,
    steps: [
      ...login("demo.expired"), ...code(), set({ "login.newPassword": NEW_PW, "login.confirm": NEW_PW }), press("Continue"), ...trustIt("Omar's phone"), press("Passkey"),
      screen("signedIn"), text("Omar"), text("Password and one-time code"), text("Trusted for 90 days"), text("Passkey"), text("Changed just now"),
    ],
  },
  {
    id: "T-46", name: "Opened from the session timeout it says the person was signed out for their security, and nothing was kept", covers: ["AC-16"], ...base, launch: { "launch.reason": "expired" },
    steps: [screen("credentials"), text("You were signed out for your security. Sign in again to continue. Nothing you were doing was saved.")],
  },
  {
    id: "T-47", name: "Without that reason the banner is not there", covers: ["AC-16"], ...base,
    steps: [screen("credentials"), noText("You were signed out for your security")],
  },
  {
    id: "T-48", name: "\"Forgot password?\" opens the reset with the typed username; \"Forgot username?\" opens that journey", covers: ["AC-16"], ...base,
    steps: [
      set({ "login.username": "alex.morgan" }), press("Forgot password?"), { expectOpens: { journey: "reset-password", with: { "launch.mode": "reset", "launch.user": "alex.morgan" } } }, screen("ident"), text("Reset your password"), text("alex.morgan"),
    ],
  },
  {
    id: "T-49", name: "\"Forgot username?\" opens Forgot username", covers: ["AC-16"], ...base,
    steps: [press("Forgot username?"), { expectOpens: { journey: "forgot-username" } }, screen("find")],
  },
  {
    id: "T-50", name: "A username given to the journey is filled in", covers: ["AC-16"], ...base, launch: { "launch.user": "alex.morgan" },
    steps: [screen("credentials"), text("alex.morgan")],
  },
  // ---- the bank does not answer: nothing is changed, no wrong try is counted, the password is not kept ----
  {
    id: "T-51", name: "The bank is unavailable when the password is sent: nothing changed, no wrong try counted, the password gone, and the person can try again", covers: ["AC-14", "AC-15"], ...base, conditions: { ...known, ...unavailable("bank.auth.signIn") },
    steps: [...login("alex.morgan", "typed-password-9"), screen("problem"), text(SORRY), press("Try again"), screen("credentials"), noText("typed-password-9"), inspect("alex.morgan", "failedSignIns", 0)],
  },
  {
    id: "T-52", name: "The bank times out when the password is sent: told so, nothing changed, no wrong try counted", covers: ["AC-14"], ...base, conditions: { ...known, timeout: ["bank.auth.signIn"] },
    steps: [...login(), screen("problem"), text(SLOW), inspect("alex.morgan", "failedSignIns", 0), inspect("alex.morgan", "sessionOpen", false)],
  },
  {
    id: "T-53", name: "The bank is unavailable when this device is read at the start", covers: ["AC-14"], ...base, conditions: unavailable("bank.device.options"),
    steps: [screen("problem"), text(SORRY), press("Try again"), screen("problem")],
  },
  {
    id: "T-54", name: "The code cannot be sent: nothing changed", covers: ["AC-14"], ...base, conditions: { ...fresh, ...unavailable("bank.otp.send") },
    steps: [...login(), screen("problem"), text(SORRY)],
  },
  {
    id: "T-56", name: "The code cannot be checked: nothing changed and the code is not used up", covers: ["AC-14", "AC-15"], ...base, conditions: { ...fresh, unavailable: ["bank.otp.verify"] },
    steps: [...login(), screen("code"), ...code(), screen("problem"), text(SORRY), inspect("alex.morgan", "failedSignIns", 0), inspect("alex.morgan", "locked", false)],
  },
  {
    id: "T-57", name: "The new password cannot be saved: nothing changed, the password gone from the screen", covers: ["AC-14", "AC-15"], ...base, conditions: { ...fresh, timeout: ["bank.auth.changePassword"] },
    steps: [...login("demo.expired"), ...code(), set({ "login.newPassword": NEW_PW, "login.confirm": NEW_PW }), press("Continue"), screen("problem"), text(SLOW), press("Try again"), noText(NEW_PW), bank("bank.auth.signIn", { username: "demo.expired", password: PW }, "ok", true)],
  },
  {
    id: "T-58", name: "The device cannot be trusted just now: nothing changed", covers: ["AC-14"], ...base, conditions: { ...fresh, unavailable: ["bank.auth.trustDevice"] },
    steps: [...toTrust, ...trustIt(), screen("problem"), text(SORRY), inspect("alex.morgan", "trustedDevices", ["dev_iphone15", "dev_laptop", "dev_tablet"])],
  },
  {
    id: "T-59", name: "Face ID cannot be turned on just now: nothing changed", covers: ["AC-14"], ...base, conditions: { ...known, unavailable: ["bank.auth.setQuickSignIn"] },
    steps: [...login(), press("Face ID or fingerprint"), screen("problem"), text(SORRY), inspect("alex.morgan", "quick", {})],
  },
  {
    id: "T-60", name: "The passkey cannot be turned on just now: nothing changed", covers: ["AC-14"], ...base, conditions: { ...known, timeout: ["bank.auth.setQuickSignIn"] },
    steps: [...login(), press("Passkey"), screen("problem"), text(SLOW)],
  },
  {
    id: "T-61", name: "The PIN cannot be turned on just now: nothing changed, the PIN gone from the screen", covers: ["AC-14", "AC-15"], ...base, conditions: { ...known, unavailable: ["bank.auth.setQuickSignIn"] },
    steps: [...login(), press("6-digit quick PIN"), set({ "login.pin": "504719", "login.pinConfirm": "504719" }), press("Continue"), screen("problem"), text(SORRY), press("Try again"), noText("504719")],
  },
  {
    id: "T-62", name: "The session cannot be opened at the end: nothing is signed in", covers: ["AC-14"], ...base, conditions: { ...known, unavailable: ["bank.auth.completeSignIn"] },
    steps: [...login(), press("Not now"), screen("problem"), text(SORRY), inspect("alex.morgan", "sessionOpen", false)],
  },
  {
    id: "T-63", name: "The quick PIN cannot be checked: nothing changed, the PIN gone", covers: ["AC-14", "AC-15"], ...base, conditions: { ...known, unavailable: ["bank.auth.quickSignIn"] }, setup: quickSetup,
    steps: [press("Use PIN"), set({ "login.quickPin": "504719" }), press("Continue"), screen("problem"), text(SORRY), press("Try again"), screen("credentials")],
  },
  {
    id: "T-64", name: "Face ID cannot be checked: nothing changed", covers: ["AC-14"], ...base, conditions: { ...known, unavailable: ["bank.auth.quickSignIn"] },
    setup: [{ adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW } }, { adapter: "bank.auth.setQuickSignIn", input: { method: "biometric" } }, { adapter: "bank.auth.completeSignIn", input: { remember: true } }],
    steps: [press("Use Face ID"), screen("problem"), text(SORRY)],
  },
  {
    id: "T-65", name: "The passkey cannot be checked: nothing changed", covers: ["AC-14"], ...base, conditions: { ...known, unavailable: ["bank.auth.quickSignIn"] },
    setup: [{ adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW } }, { adapter: "bank.auth.setQuickSignIn", input: { method: "passkey" } }, { adapter: "bank.auth.completeSignIn", input: { remember: true } }],
    steps: [press("Use passkey"), screen("problem"), text(SORRY)],
  },
];
