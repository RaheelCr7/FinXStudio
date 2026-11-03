import type { Block, Journey, Screen } from "../schema";

/**
 * Access journeys for Cairo Amman Bank's retail mobile app, from its design file: sign in, default sign-in, account
 * preview, language, enrol, activate, can't sign in, locate us and support. English and Arabic (right to left).
 * The behaviour follows the bank's digital banking platform (outcomes, error codes, password rules, one-time code);
 * the `cab.*` sandbox adapters stand in for its services. Arabic copy and the sample support texts need the bank's review.
 */
const L = (en: string, ar: string) => ({ en, ar });
const base = {
  version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["cab"],
  locale: { default: "en", supported: ["en", "ar"], rtl: ["ar"] },
};

const text = (t: ReturnType<typeof L>, variant?: "title" | "body" | "caption"): Block => ({ type: "text", text: t, ...(variant ? { variant } : {}) });
const alert = (tone: "info" | "warning" | "error" | "success", t: ReturnType<typeof L>, visibleWhen?: string): Block => ({ type: "alert", tone, text: t, ...(visibleWhen ? { visibleWhen } : {}) });
const button = (label: ReturnType<typeof L>, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary", visibleWhen?: string): Block => ({ type: "button", label, variant, actions, ...(visibleWhen ? { visibleWhen } : {}) });
const input = (bind: string, label: ReturnType<typeof L>, extra: Record<string, unknown> = {}): Block => ({ type: "textInput", bind, label, ...extra } as Block);
const hero: Block = { type: "hero" };
const header = (title: ReturnType<typeof L>, toScreen?: string): Block => ({ type: "sectionHeader", title, ...(toScreen ? { action: { label: L("English", "العربية"), actions: [{ type: "navigate", to: toScreen }] } } : {}) });
const shortcuts = (): Block => ({
  type: "shortcuts",
  items: [
    { id: "enroll", label: L("Enroll/Activate", "التسجيل/التفعيل"), icon: "userPlus", actions: [{ type: "exit" }] },
    { id: "locate", label: L("Locate us", "مواقعنا"), icon: "mapPin", actions: [{ type: "exit" }] },
    { id: "support", label: L("Support", "الدعم"), icon: "send", actions: [{ type: "exit" }] },
  ],
});
const done = button(L("Close", "إغلاق"), [{ type: "exit" }]);
const result = (tone: "success" | "error", title: ReturnType<typeof L>, t?: ReturnType<typeof L>, meta?: ReturnType<typeof L>): Block => ({ type: "result", tone, title, ...(t ? { text: t } : {}), ...(meta ? { meta } : {}) });
const end = (id: string, title: ReturnType<typeof L>, blocks: Block[]): Screen => ({ id, title, kind: "terminal", blocks });
const go = (to: string) => ({ type: "navigate" as const, to });
const route = (rules: { when: string; to: string }[]) => ({ rules });

/** The two password fields and the bank's rules, shared by activation and reset. */
const passwordFields = (bind: string, confirm: string): Block[] => [
  input(bind, L("New Password", "كلمة المرور الجديدة"), { secure: true, placeholder: L("Enter a new password", "أدخل كلمة مرور جديدة") }),
  input(confirm, L("Re-Enter Your New Password", "أعد إدخال كلمة المرور الجديدة"), { secure: true, placeholder: L("Re-enter your new password", "أعد إدخال كلمة المرور الجديدة") }),
  text(L("Security Requirements:", "متطلبات الأمان:"), "caption"),
  text(L("- Password must contain {{policy.differentChars}} different characters", "- يجب أن تحتوي كلمة المرور على {{policy.differentChars}} أحرف مختلفة"), "caption"),
  text(L("- Password must contain at least {{policy.minLength}} characters", "- يجب أن تحتوي كلمة المرور على {{policy.minLength}} أحرف على الأقل"), "caption"),
  text(L("- Password must not exceed {{policy.maxLength}} characters", "- يجب ألا تتجاوز كلمة المرور {{policy.maxLength}} حرف"), "caption"),
  text(L("- Password must not contain username", "- يجب ألا تحتوي كلمة المرور على اسم المستخدم"), "caption"),
];

/* ============================================================== 1. Sign in */
export const signIn: Journey = {
  ...base, id: "jrn_cab_sign_in", slug: "sign-in", name: L("Sign in", "تسجيل الدخول"), entryScreen: "welcome",
  dataModel: {
    "language.code": { type: "string", required: true },
    "login.username": { type: "string", required: true },
    "login.password": { type: "string", required: true },
    "login.remember": { type: "boolean" },
  },
  integrations: [{ id: "signIn", adapter: "cab.auth.signIn", mode: "sandbox" }, { id: "languages", adapter: "cab.language.list", mode: "sandbox" }, { id: "setLanguage", adapter: "cab.language.set", mode: "sandbox" }],
  screens: [
    {
      id: "welcome", title: L("Welcome", "مرحباً"),
      blocks: [
        hero,
        header(L("Welcome", "مرحباً"), "language"),
        { type: "menu", items: [
          { id: "explore", label: L("Explore products", "استكشف المنتجات"), text: L("Choose from our diverse selection of products to meet your financial needs", "اختر من مجموعتنا المتنوعة من المنتجات التي تلبي احتياجاتك المالية"), icon: "search", actions: [go("fullapp")] },
          { id: "resume", label: L("Resume Application", "استئناف الطلب"), text: L("Would you like to resume your existing application", "تابع من حيث توقفت في طلبك الحالي"), icon: "refresh", actions: [go("fullapp")] },
          { id: "login", label: L("Existing user login", "تسجيل دخول مستخدم حالي"), text: L("Log in to access your Cairo Amman digital account", "سجّل الدخول للوصول إلى حسابك الرقمي في بنك القاهرة عمّان"), icon: "user", actions: [go("login")] },
        ] },
        shortcuts(),
      ],
    },
    {
      id: "login", title: L("Sign in", "تسجيل الدخول"),
      onEnter: [{ type: "setData", path: "login.remember", value: true }],
      blocks: [
        hero,
        header(L("Welcome", "مرحباً"), "language"),
        input("login.username", L("Username", "اسم المستخدم")),
        input("login.password", L("Password", "كلمة المرور"), { secure: true }),
        alert("error", L("Incorrect username or password. {{auth.result.attemptsLeft}} attempt(s) left before your profile is locked.", "اسم المستخدم أو كلمة المرور غير صحيحة. تبقّت {{auth.result.attemptsLeft}} محاولة قبل قفل ملفك الشخصي."), "auth.result.code == 'INVALID_CREDENTIALS'"),
        { type: "toggle", bind: "login.remember", label: L("Remember me", "تذكرني"), link: { label: L("Can't Sign In?", "لا يمكنني تسجيل الدخول؟"), actions: [go("cant")] } },
        button(L("Sign In", "تسجيل الدخول"), [
          { type: "validate" },
          { type: "callApi", integration: "signIn", input: { username: "{{login.username}}", password: "{{login.password}}" }, saveAs: "auth.result", onError: { showToast: L("We couldn't reach the bank. Try again.", "تعذّر الاتصال بالبنك. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
        shortcuts(),
      ],
      navigation: route([
        { when: "auth.result.ok", to: "signed-in" }, { when: "auth.result.code == 'LOCKED'", to: "locked" },
        { when: "auth.result.code == 'PASSWORD_EXPIRED'", to: "expired" }, { when: "auth.result.code == 'INACTIVE'", to: "inactive" },
      ]),
    },
    {
      id: "language", title: L("Welcome", "مرحباً"),
      onEnter: [{ type: "callApi", integration: "languages", saveAs: "ctx.languages" }],
      blocks: [
        text(L("Choose your language", "اختر لغتك"), "title"),
        { type: "select", bind: "language.code", label: L("Language", "اللغة"), source: "ctx.languages", variant: "rows" },
        button(L("Update Language", "تحديث اللغة"), [{ type: "validate" }, go("language-confirm")]),
        button(L("Cancel", "إلغاء"), [go("login")], "ghost"),
      ],
    },
    {
      id: "language-confirm", title: L("Language change", "تغيير اللغة"),
      blocks: [
        text(L("Language change", "تغيير اللغة"), "title"),
        text(L("Are you sure you want to change your language setting?", "هل أنت متأكد من رغبتك في تغيير إعداد اللغة؟")),
        button(L("Yes", "نعم"), [{ type: "callApi", integration: "setLanguage", input: { code: "{{language.code}}" }, saveAs: "changed", onError: { showToast: L("That language isn't available.", "هذه اللغة غير متاحة.") } }, { type: "showToast", text: L("Language updated to {{changed.name}}", "تم تحديث اللغة إلى {{changed.name}}") }, go("login")]),
        button(L("No", "لا"), [go("language")], "ghost"),
      ],
    },
    end("cant", L("Can't Sign In?", "لا يمكنني تسجيل الدخول؟"), [
      result("success", L("Use Can't Sign In", "استخدم \"لا يمكنني تسجيل الدخول\""), L("Open the Can't Sign In journey to find your profile, verify with a one-time code and choose a new password.", "افتح رحلة \"لا يمكنني تسجيل الدخول\" للعثور على ملفك الشخصي والتحقق برمز لمرة واحدة واختيار كلمة مرور جديدة.")),
      button(L("Back to sign in", "العودة إلى تسجيل الدخول"), [go("login")], "secondary"),
    ]),
    end("signed-in", L("Signed in", "تم تسجيل الدخول"), [
      result("success", L("Welcome back, {{auth.result.firstName}}", "أهلاً بعودتك، {{auth.result.firstName}}"),
        L("You're signed in. Net worth {{auth.result.netWorth | money}} {{auth.result.currency}} across {{auth.result.accountCount}} accounts.", "تم تسجيل دخولك. صافي الثروة {{auth.result.netWorth | money}} {{auth.result.currency}} عبر {{auth.result.accountCount}} حسابات."),
        L("Last sign in {{auth.result.lastLogin}}", "آخر تسجيل دخول {{auth.result.lastLogin}}")),
      button(L("Done", "تم"), [{ type: "exit" }]),
    ]),
    end("locked", L("Profile locked", "الملف الشخصي مقفل"), [
      result("error", L("Your profile is locked", "ملفك الشخصي مقفل"), L("For your security, sign in is blocked for {{auth.result.lockMinutes}} minutes. Try again later, or choose Can't Sign In to reset your password.", "حفاظاً على أمانك، تم إيقاف تسجيل الدخول لمدة {{auth.result.lockMinutes}} دقيقة. حاول لاحقاً أو اختر \"لا يمكنني تسجيل الدخول\" لإعادة تعيين كلمة المرور.")),
      done,
    ]),
    end("expired", L("Password expired", "انتهت صلاحية كلمة المرور"), [
      result("error", L("Your password has expired", "انتهت صلاحية كلمة المرور"), L("Reset it with Can't Sign In, then sign in again.", "أعد تعيينها من خلال \"لا يمكنني تسجيل الدخول\" ثم سجّل الدخول مرة أخرى.")),
      done,
    ]),
    end("inactive", L("Profile not active", "الملف الشخصي غير مفعّل"), [
      result("error", L("Your profile isn't active yet", "ملفك الشخصي غير مفعّل بعد"), L("Activate it with the username and activation code the bank sent you, using Enroll / Activate.", "فعّله باستخدام اسم المستخدم ورمز التفعيل اللذين أرسلهما البنك عبر \"التسجيل / التفعيل\".")),
      done,
    ]),
    end("fullapp", L("Not part of sign in", "ليس جزءاً من تسجيل الدخول"), [
      result("success", L("Opens in the full app", "يُفتح في التطبيق الكامل"), L("Explore products and Resume application are separate product journeys. Choose Existing user login to sign in.", "استكشاف المنتجات واستئناف الطلب رحلتان منفصلتان. اختر \"تسجيل دخول مستخدم حالي\" لتسجيل الدخول.")),
      button(L("Back", "رجوع"), [go("welcome")], "secondary"),
    ]),
  ],
};

/* ====================================================== 2. Default sign in */
export const defaultSignIn: Journey = {
  ...base, id: "jrn_cab_default_sign_in", slug: "default-sign-in", name: L("Default sign in", "طريقة تسجيل الدخول الافتراضية"), entryScreen: "choose",
  dataModel: {
    "signin.mode": { type: "string", required: true },
    "pin.value": { type: "string", required: true },
    "pin.confirm": { type: "string", required: true },
    "pin.checked": { type: "boolean" },
  },
  integrations: [{ id: "deviceOptions", adapter: "cab.device.options", mode: "sandbox" }, { id: "setDefault", adapter: "cab.device.setDefault", mode: "sandbox" }],
  screens: [
    {
      id: "choose", title: L("Default sign in", "تسجيل الدخول الافتراضي"),
      onEnter: [{ type: "callApi", integration: "deviceOptions", saveAs: "device" }],
      blocks: [
        text(L("Please select your default sign in option", "يرجى اختيار طريقة تسجيل الدخول الافتراضية"), "title"),
        text(L("Current default: {{device.default}}", "الطريقة الحالية: {{device.default}}"), "caption"),
        {
          type: "select", bind: "signin.mode", label: L("Sign in with", "تسجيل الدخول باستخدام"), variant: "rows",
          choices: [
            { id: "password", label: L("Username & password", "اسم المستخدم وكلمة المرور"), text: L("Default sign in", "الافتراضي") },
            { id: "biometric", label: L("Biometric", "البصمة"), text: L("Use your fingerprint or face", "استخدم بصمتك أو وجهك") },
            { id: "pin", label: L("PIN", "الرقم السري"), text: L("A 6-digit PIN you choose", "رقم سري من 6 أرقام تختاره") },
          ],
        },
        button(L("Continue", "متابعة"), [{ type: "validate" }, { type: "navigate" }]),
      ],
      navigation: route([{ when: "signin.mode == 'pin'", to: "pin-new" }, { when: "signin.mode == 'biometric'", to: "biometric" }, { when: "signin.mode == 'password'", to: "password-set" }]),
    },
    {
      id: "pin-new", title: L("Default sign in", "تسجيل الدخول الافتراضي"),
      blocks: [
        text(L("Enter New Sign in PIN", "أدخل الرقم السري الجديد"), "title"),
        { type: "otp", bind: "pin.value", length: 6, keypad: true, masked: true, hint: L("Step 1 of 2", "الخطوة 1 من 2") },
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("pin-confirm")]),
      ],
    },
    {
      id: "pin-confirm", title: L("Default sign in", "تسجيل الدخول الافتراضي"),
      blocks: [
        text(L("Re-Enter New Sign in PIN", "أعد إدخال الرقم السري الجديد"), "title"),
        { type: "otp", bind: "pin.confirm", length: 6, keypad: true, masked: true, hint: L("Step 2 of 2", "الخطوة 2 من 2") },
        alert("error", L("The PINs do not match. Enter the same PIN twice.", "الرقمان السريان غير متطابقين. أدخل الرقم نفسه مرتين."), "pin.checked && pin.confirm != pin.value"),
        button(L("Continue", "متابعة"), [{ type: "validate" }, { type: "setData", path: "pin.checked", value: true }, { type: "navigate" }]),
      ],
      navigation: route([{ when: "pin.confirm == pin.value", to: "pin-intro" }]),
    },
    {
      id: "pin-intro", title: L("PIN Sign In", "تسجيل الدخول بالرقم السري"),
      blocks: [
        text(L("PIN", "الرقم السري"), "title"),
        text(L("Do you want to set up PIN authentication for secure and convenient sign in?", "هل تريد إعداد المصادقة بالرقم السري لتسجيل دخول آمن ومريح؟")),
        button(L("Set as default", "تعيين كافتراضي"), [
          { type: "callApi", integration: "setDefault", input: { mode: "pin", pin: "{{pin.value}}" }, onError: { showToast: L("We couldn't save your PIN. Try again.", "تعذّر حفظ الرقم السري. حاول مرة أخرى.") } },
          go("done"),
        ]),
      ],
    },
    {
      id: "biometric", title: L("Biometric", "البصمة"),
      blocks: [
        text(L("Biometric", "البصمة"), "title"),
        text(L("You can use your device biometrics to simplify Sign In", "يمكنك استخدام بصمة جهازك لتسهيل تسجيل الدخول")),
        button(L("Set as default", "تعيين كافتراضي"), [
          { type: "callApi", integration: "setDefault", input: { mode: "biometric" }, onError: { showToast: L("We couldn't save this setting. Try again.", "تعذّر حفظ هذا الإعداد. حاول مرة أخرى.") } },
          go("done"),
        ]),
      ],
    },
    {
      id: "password-set", title: L("Username & password", "اسم المستخدم وكلمة المرور"),
      blocks: [
        text(L("Sign in with your username and password", "سجّل الدخول باسم المستخدم وكلمة المرور"), "title"),
        button(L("Set as default", "تعيين كافتراضي"), [{ type: "callApi", integration: "setDefault", input: { mode: "password" }, onError: { showToast: L("We couldn't save this setting. Try again.", "تعذّر حفظ هذا الإعداد. حاول مرة أخرى.") } }, go("done")]),
      ],
    },
    end("done", L("Success", "تم بنجاح"), [
      result("success", L("Success", "تم بنجاح"),
        L("You have successfully set {{signin.mode == 'pin' ? 'PIN' : (signin.mode == 'biometric' ? 'Biometric' : 'Username & password')}} sign in as default. You can change it any time from Menu, then Settings.", "لقد قمت بتعيين طريقة تسجيل الدخول الافتراضية بنجاح. يمكنك تغييرها في أي وقت من القائمة ثم الإعدادات.")),
      done,
    ]),
  ],
};

/* ============================================= 3. Account preview before sign in */
export const accountPreview: Journey = {
  ...base, id: "jrn_cab_account_preview", slug: "account-preview", name: L("Account preview", "معاينة الحساب"), entryScreen: "settings",
  dataModel: { "preview.enabled": { type: "boolean" }, "preview.pick": { type: "string" } },
  integrations: [{ id: "preview", adapter: "cab.preview.get", mode: "sandbox" }, { id: "previewAccounts", adapter: "cab.preview.accounts", mode: "sandbox" }, { id: "previewSet", adapter: "cab.preview.set", mode: "sandbox" }],
  screens: [
    {
      id: "settings", title: L("Account preview", "معاينة الحساب"),
      onEnter: [{ type: "callApi", integration: "preview", saveAs: "preview" }, { type: "callApi", integration: "previewAccounts", saveAs: "ctx.previewAccounts" }],
      blocks: [
        text(L("See your account and card balances without having to sign in", "اطّلع على أرصدة حساباتك وبطاقاتك دون الحاجة إلى تسجيل الدخول"), "title"),
        { type: "toggle", bind: "preview.enabled", label: L("Enable Account Preview", "تفعيل معاينة الحساب") },
        alert("info", L("Anyone holding this device can see your balances on the sign-in screen while this is on.", "يمكن لأي شخص يحمل هذا الجهاز رؤية أرصدتك في شاشة تسجيل الدخول طالما أن هذه الميزة مفعّلة.")),
        button(L("Save", "حفظ"), [
          { type: "callApi", integration: "previewSet", input: { enabled: "{{preview.enabled}}" }, onError: { showToast: L("We couldn't save this setting. Try again.", "تعذّر حفظ هذا الإعداد. حاول مرة أخرى.") } },
          go("saved"),
        ]),
      ],
    },
    {
      id: "saved", title: L("Account preview", "معاينة الحساب"), kind: "terminal",
      blocks: [
        result("success", L("Account preview is {{preview.enabled ? 'on' : 'off'}}", "معاينة الحساب {{preview.enabled ? 'مفعّلة' : 'متوقفة'}}")),
        text(L("This is what the sign-in screen shows", "هذا ما تعرضه شاشة تسجيل الدخول"), "caption"),
        { type: "accountPicker", bind: "preview.pick", source: "ctx.previewAccounts", showBalance: true, visibleWhen: "preview.enabled" },
        done,
      ],
    },
  ],
};

/* ============================================================ 4. Language */
export const changeLanguage: Journey = {
  ...base, id: "jrn_cab_change_language", slug: "change-language", name: L("Change language", "تغيير اللغة"), entryScreen: "choose",
  dataModel: { "language.code": { type: "string", required: true } },
  integrations: [{ id: "languages", adapter: "cab.language.list", mode: "sandbox" }, { id: "setLanguage", adapter: "cab.language.set", mode: "sandbox" }],
  screens: [
    {
      id: "choose", title: L("Language", "اللغة"),
      onEnter: [{ type: "callApi", integration: "languages", saveAs: "ctx.languages" }],
      blocks: [
        text(L("Choose your language", "اختر لغتك"), "title"),
        { type: "select", bind: "language.code", label: L("Language", "اللغة"), source: "ctx.languages", variant: "rows" },
        button(L("Update Language", "تحديث اللغة"), [{ type: "validate" }, go("confirm")]),
        button(L("Cancel", "إلغاء"), [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "confirm", title: L("Language change", "تغيير اللغة"),
      blocks: [
        text(L("Are you sure you want to change your language setting?", "هل أنت متأكد من رغبتك في تغيير إعداد اللغة؟"), "title"),
        button(L("Yes", "نعم"), [{ type: "callApi", integration: "setLanguage", input: { code: "{{language.code}}" }, saveAs: "changed", onError: { showToast: L("That language isn't available.", "هذه اللغة غير متاحة.") } }, go("done")]),
        button(L("No", "لا"), [go("choose")], "secondary"),
      ],
    },
    end("done", L("Language updated", "تم تحديث اللغة"), [result("success", L("Language updated", "تم تحديث اللغة"), L("Your language is now {{changed.name}}.", "أصبحت لغتك الآن {{changed.name}}.")), done]),
  ],
};

/* ============================================================== 5. Enrol */
export const enroll: Journey = {
  ...base, id: "jrn_cab_enroll", slug: "enroll", name: L("Enroll your account", "تسجيل حسابك"), entryScreen: "hub",
  dataModel: {
    "enroll.entity": { type: "string", required: true },
    "enroll.kind": { type: "string", required: true },
    "enroll.lastName": { type: "string", required: true },
    "enroll.nationalId": { type: "string", required: true, pattern: "^[0-9A-Za-z-]{4,20}$" },
    "enroll.dob": { type: "string", required: true, pattern: "^[0-9]{2} ?/ ?[0-9]{2} ?/ ?[0-9]{4}$" },
    "enroll.captcha": { type: "string", required: true },
  },
  integrations: [
    { id: "legalEntities", adapter: "cab.legalEntities.list", mode: "sandbox" }, { id: "captcha", adapter: "cab.captcha.generate", mode: "sandbox" },
    { id: "enrollRetail", adapter: "cab.enroll.retail", mode: "sandbox" },
  ],
  screens: [
    {
      id: "hub", title: L("Enroll / Activate your profile", "التسجيل / تفعيل ملفك الشخصي"),
      blocks: [
        { type: "menu", items: [
          { id: "enroll", label: L("Enroll your account", "سجّل حسابك"), text: L("Select enroll now to create your digital banking profile", "اختر التسجيل الآن لإنشاء ملفك المصرفي الرقمي"), icon: "user", actions: [go("entity")] },
          { id: "activate", label: L("Activate your account", "فعّل حسابك"), text: L("Select this option if you have received your username and activation code from the bank", "اختر هذا الخيار إذا استلمت اسم المستخدم ورمز التفعيل من البنك"), icon: "rocket", actions: [go("to-activate")] },
        ] },
      ],
    },
    end("to-activate", L("Activate your account", "فعّل حسابك"), [
      result("success", L("Use Activate profile", "استخدم تفعيل الملف الشخصي"), L("Open the Activate profile journey and enter the username and activation code the bank sent you.", "افتح رحلة تفعيل الملف الشخصي وأدخل اسم المستخدم ورمز التفعيل اللذين أرسلهما البنك.")),
      done,
    ]),
    {
      id: "entity", title: L("Legal entity", "الكيان القانوني"),
      onEnter: [{ type: "callApi", integration: "legalEntities", saveAs: "legal.list" }],
      blocks: [
        text(L("Select the Legal Entity", "اختر الكيان القانوني"), "title"),
        { type: "select", bind: "enroll.entity", label: L("Legal entity", "الكيان القانوني"), source: "legal.list", variant: "rows" },
        { type: "select", bind: "enroll.kind", label: L("Select an enrollment option", "اختر خيار التسجيل"), variant: "rows", choices: [{ id: "personal", label: L("Personal Banking", "الخدمات المصرفية الشخصية") }, { id: "business", label: L("Business Banking", "خدمات الأعمال المصرفية") }] },
        button(L("Continue", "متابعة"), [{ type: "validate" }, { type: "navigate" }]),
      ],
      navigation: route([{ when: "enroll.kind == 'business'", to: "business" }, { when: "enroll.kind == 'personal'", to: "last-name" }]),
    },
    end("business", L("Business banking", "الخدمات المصرفية للأعمال"), [
      result("error", L("Business banking is enrolled separately", "التسجيل في خدمات الأعمال يتم بشكل منفصل"), L("Mobile enrollment is for retail customers. Contact the bank to enrol a business profile.", "التسجيل عبر الهاتف مخصص للعملاء الأفراد. تواصل مع البنك لتسجيل ملف أعمال.")),
      done,
    ]),
    {
      id: "last-name", title: L("Last name", "اسم العائلة"),
      blocks: [
        text(L("Enter your last name as per bank records", "أدخل اسم عائلتك كما هو في سجلات البنك"), "title"),
        input("enroll.lastName", L("Last name", "اسم العائلة")),
        alert("info", L("Enrollment is only for retail banking", "التسجيل متاح للخدمات المصرفية للأفراد فقط")),
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("national-id")]),
      ],
    },
    {
      id: "national-id", title: L("National ID", "الرقم الوطني"),
      blocks: [
        text(L("Enter your personal identity number", "أدخل رقم هويتك الشخصية"), "title"),
        input("enroll.nationalId", L("National ID", "الرقم الوطني"), { patternMessage: L("Use 4 to 20 letters, digits or dashes", "استخدم من 4 إلى 20 حرفاً أو رقماً أو شرطة") }),
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("dob")]),
      ],
    },
    {
      id: "dob", title: L("Date of birth", "تاريخ الميلاد"),
      blocks: [
        text(L("Enter Your Birth Date", "أدخل تاريخ ميلادك"), "title"),
        input("enroll.dob", L("Date of birth", "تاريخ الميلاد"), { placeholder: L("DD / MM / YYYY", "يوم / شهر / سنة"), keyboard: "number", patternMessage: L("Use the format DD / MM / YYYY", "استخدم الصيغة يوم / شهر / سنة") }),
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("verify")]),
      ],
    },
    {
      id: "verify", title: L("Enroll", "التسجيل"),
      onEnter: [{ type: "callApi", integration: "captcha", saveAs: "captcha" }],
      blocks: [
        { type: "reviewSummary", rows: [
          { label: L("Last name", "اسم العائلة"), value: "{{enroll.lastName}}" }, { label: L("National ID", "الرقم الوطني"), value: "{{enroll.nationalId}}" },
          { label: L("Date of birth", "تاريخ الميلاد"), value: "{{enroll.dob}}" },
        ] },
        text(L("{{captcha.text ? captcha.text : '-----'}}", "{{captcha.text ? captcha.text : '-----'}}"), "title"),
        input("enroll.captcha", L("Code", "الرمز"), { placeholder: L("Enter the above text here", "أدخل النص أعلاه هنا") }),
        alert("error", L("That code doesn't match. Check it or ask for a new one.", "الرمز غير مطابق. تحقق منه أو اطلب رمزاً جديداً."), "enroll.result.code == 'CAPTCHA_WRONG'"),
        button(L("New code", "رمز جديد"), [{ type: "callApi", integration: "captcha", saveAs: "captcha" }], "ghost"),
        button(L("Continue", "متابعة"), [
          { type: "validate" },
          { type: "callApi", integration: "enrollRetail", input: { captchaKey: "{{captcha.serviceKey}}", captchaValue: "{{enroll.captcha}}", lastName: "{{enroll.lastName}}", nationalId: "{{enroll.nationalId}}", dob: "{{enroll.dob}}" }, saveAs: "enroll.result", onError: { showToast: L("We couldn't reach the bank. Try again.", "تعذّر الاتصال بالبنك. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "enroll.result.ok", to: "enrolled" }, { when: "enroll.result.code == 'NOT_FOUND'", to: "cant-enroll" }, { when: "enroll.result.code == 'ALREADY_ENROLLED'", to: "welcome-back" }]),
    },
    end("enrolled", L("Enrolled", "تم التسجيل"), [
      result("success", L("You have successfully enrolled to retail banking", "تم تسجيلك بنجاح في الخدمات المصرفية للأفراد"),
        L("Your user ID and an activation code have been sent to {{enroll.result.maskedEmail}} and {{enroll.result.maskedPhone}}. Please activate your profile to start using personal banking.", "تم إرسال معرّف المستخدم ورمز التفعيل إلى {{enroll.result.maskedEmail}} و{{enroll.result.maskedPhone}}. يرجى تفعيل ملفك الشخصي لبدء استخدام الخدمات المصرفية الشخصية.")),
      button(L("Activate your profile", "فعّل ملفك الشخصي"), [{ type: "exit" }]),
    ]),
    end("cant-enroll", L("Can't enroll", "تعذّر التسجيل"), [
      result("error", L("We couldn't enroll you", "تعذّر تسجيلك"), L("The details don't match the bank's records. Check them and try again, or call support.", "التفاصيل لا تطابق سجلات البنك. تحقق منها وحاول مرة أخرى أو اتصل بالدعم.")),
      button(L("Try again", "حاول مرة أخرى"), [go("last-name")]), done,
    ]),
    end("welcome-back", L("Welcome back", "أهلاً بعودتك"), [
      result("success", L("You're already enrolled, {{enroll.result.firstName}}", "أنت مسجّل بالفعل، {{enroll.result.firstName}}"), L("Sign in with your username and password.", "سجّل الدخول باسم المستخدم وكلمة المرور.")),
      button(L("Sign in", "تسجيل الدخول"), [{ type: "exit" }]),
    ]),
  ],
};

/* ====================================================== 6. Activate profile */
export const activateProfile: Journey = {
  ...base, id: "jrn_cab_activate_profile", slug: "activate-profile", name: L("Activate your profile", "تفعيل ملفك الشخصي"), entryScreen: "credentials",
  dataModel: {
    "activate.username": { type: "string", required: true }, "activate.code": { type: "string", required: true },
    "activate.password": { type: "string", required: true }, "activate.confirm": { type: "string", required: true },
  },
  integrations: [
    { id: "activate", adapter: "cab.activate.validate", mode: "sandbox" }, { id: "policy", adapter: "cab.password.policy", mode: "sandbox" },
    { id: "setPassword", adapter: "cab.activate.setPassword", mode: "sandbox" },
  ],
  screens: [
    {
      id: "credentials", title: L("Profile activation", "تفعيل الملف الشخصي"),
      blocks: [
        alert("info", L("Please enter user ID and Activation code that was sent to your email and phone", "يرجى إدخال معرّف المستخدم ورمز التفعيل اللذين أُرسلا إلى بريدك الإلكتروني وهاتفك")),
        input("activate.username", L("Username", "اسم المستخدم"), { placeholder: L("Enter username", "أدخل اسم المستخدم") }),
        input("activate.code", L("Activation Code", "رمز التفعيل"), { placeholder: L("Enter activation code", "أدخل رمز التفعيل") }),
        alert("error", L("You've entered an incorrect username or activation code. {{activation.result.attemptsLeft}} attempt(s) left.", "أدخلت اسم مستخدم أو رمز تفعيل غير صحيح. تبقّت {{activation.result.attemptsLeft}} محاولة."), "activation.result.code == 'INVALID'"),
        button(L("Verify", "تحقق"), [
          { type: "validate" },
          { type: "callApi", integration: "activate", input: { username: "{{activate.username}}", code: "{{activate.code}}" }, saveAs: "activation.result", onError: { showToast: L("We couldn't reach the bank. Try again.", "تعذّر الاتصال بالبنك. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "activation.result.ok", to: "create-password" }, { when: "activation.result.code == 'BLOCKED'", to: "blocked" }]),
    },
    {
      id: "create-password", title: L("Password", "كلمة المرور"),
      onEnter: [{ type: "callApi", integration: "policy", saveAs: "policy" }],
      blocks: [
        ...passwordFields("activate.password", "activate.confirm"),
        alert("error", L("The two passwords don't match.", "كلمتا المرور غير متطابقتين."), "pw.result.code == 'MISMATCH'"),
        alert("error", L("That password doesn't meet the security requirements.", "كلمة المرور لا تستوفي متطلبات الأمان."), "pw.result.code == 'POLICY'"),
        button(L("Create password", "إنشاء كلمة المرور"), [
          { type: "validate" },
          { type: "callApi", integration: "setPassword", input: { password: "{{activate.password}}", confirm: "{{activate.confirm}}" }, saveAs: "pw.result", onError: { showToast: L("We couldn't reach the bank. Try again.", "تعذّر الاتصال بالبنك. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "pw.result.ok", to: "activated" }]),
    },
    end("activated", L("Activated", "تم التفعيل"), [
      result("success", L("Activated successfully", "تم التفعيل بنجاح"), L("We have activated your profile successfully. Please sign in to continue.", "تم تفعيل ملفك الشخصي بنجاح. يرجى تسجيل الدخول للمتابعة.")),
      button(L("Sign in", "تسجيل الدخول"), [{ type: "exit" }]),
    ]),
    end("blocked", L("Activation blocked", "تم حظر التفعيل"), [
      result("error", L("Your activation code is blocked", "تم حظر رمز التفعيل"), L("Choose Can't Sign In to regenerate a new activation code.", "اختر \"لا يمكنني تسجيل الدخول\" لإنشاء رمز تفعيل جديد.")),
      done,
    ]),
  ],
};

/* ======================================================== 7. Can't sign in */
export const cantSignIn: Journey = {
  ...base, id: "jrn_cab_cant_sign_in", slug: "cant-sign-in", name: L("Can't sign in", "لا يمكنني تسجيل الدخول"), entryScreen: "entity",
  dataModel: {
    "recover.entity": { type: "string", required: true },
    "recover.email": { type: "string", required: true, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    "recover.captcha": { type: "string", required: true },
    "recover.phone": { type: "string", required: true, pattern: "^[0-9 +()-]{7,20}$" },
    "recover.dob": { type: "string", required: true, pattern: "^[0-9]{2} ?/ ?[0-9]{2} ?/ ?[0-9]{4}$" },
    "recover.channel": { type: "string", required: true },
    "recover.password": { type: "string", required: true }, "recover.confirm": { type: "string", required: true },
    "otp.code": { type: "string", required: true },
  },
  integrations: [
    { id: "legalEntities", adapter: "cab.legalEntities.list", mode: "sandbox" }, { id: "captcha", adapter: "cab.captcha.generate", mode: "sandbox" },
    { id: "captchaCheck", adapter: "cab.captcha.verify", mode: "sandbox" }, { id: "verifyUser", adapter: "cab.recover.verifyUser", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" }, { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "policy", adapter: "cab.password.policy", mode: "sandbox" }, { id: "resetPassword", adapter: "cab.recover.resetPassword", mode: "sandbox" },
    { id: "regenerate", adapter: "cab.activate.regenerate", mode: "sandbox" },
  ],
  screens: [
    {
      id: "entity", title: L("Legal entity", "الكيان القانوني"),
      onEnter: [{ type: "callApi", integration: "legalEntities", saveAs: "legal.list" }],
      blocks: [
        text(L("Select the Legal Entity", "اختر الكيان القانوني"), "title"),
        { type: "select", bind: "recover.entity", label: L("Legal entity", "الكيان القانوني"), source: "legal.list" },
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("email")]),
      ],
    },
    {
      id: "email", title: L("Let's verify it's you", "لنتحقق من هويتك"),
      onEnter: [{ type: "callApi", integration: "captcha", saveAs: "captcha" }],
      blocks: [
        text(L("Enter Recipient E-mail ID", "أدخل البريد الإلكتروني للمستلم"), "title"),
        input("recover.email", L("Email", "البريد الإلكتروني"), { keyboard: "email", patternMessage: L("Enter a valid email address", "أدخل بريداً إلكترونياً صالحاً") }),
        text(L("{{captcha.text ? captcha.text : '-----'}}", "{{captcha.text ? captcha.text : '-----'}}"), "title"),
        input("recover.captcha", L("Code", "الرمز"), { placeholder: L("Enter the above text here", "أدخل النص أعلاه هنا") }),
        alert("error", L("Wrong code entered. Check it or ask for a new one.", "الرمز المُدخل غير صحيح. تحقق منه أو اطلب رمزاً جديداً."), "captchaState.ok == false"),
        button(L("New code", "رمز جديد"), [{ type: "callApi", integration: "captcha", saveAs: "captcha" }], "ghost"),
        button(L("Continue", "متابعة"), [
          { type: "validate" },
          { type: "callApi", integration: "captchaCheck", input: { serviceKey: "{{captcha.serviceKey}}", value: "{{recover.captcha}}" }, saveAs: "captchaState" },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "captchaState.ok", to: "phone" }]),
    },
    {
      id: "phone", title: L("Let's verify it's you", "لنتحقق من هويتك"),
      blocks: [
        text(L("Enter Phone Number", "أدخل رقم الهاتف"), "title"),
        input("recover.phone", L("Phone number", "رقم الهاتف"), { keyboard: "phone", placeholder: L("+962 34 56 78 90", "+962 34 56 78 90"), patternMessage: L("Enter at least 7 digits", "أدخل 7 أرقام على الأقل") }),
        button(L("Continue", "متابعة"), [{ type: "validate" }, go("dob")]),
      ],
    },
    {
      id: "dob", title: L("Let's verify it's you", "لنتحقق من هويتك"),
      blocks: [
        text(L("Enter Your Birth Date", "أدخل تاريخ ميلادك"), "title"),
        input("recover.dob", L("Date of birth", "تاريخ الميلاد"), { placeholder: L("DD / MM / YYYY", "يوم / شهر / سنة"), keyboard: "number", patternMessage: L("Use the format DD / MM / YYYY", "استخدم الصيغة يوم / شهر / سنة") }),
        button(L("Continue", "متابعة"), [
          { type: "validate" },
          { type: "callApi", integration: "verifyUser", input: { captchaKey: "{{captcha.serviceKey}}", captchaValue: "{{recover.captcha}}", email: "{{recover.email}}", phone: "{{recover.phone}}", dob: "{{recover.dob}}" }, saveAs: "recover.result", onError: { showToast: L("We couldn't reach the bank. Try again.", "تعذّر الاتصال بالبنك. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "recover.result.ok", to: "found" }, { when: "recover.result.code == 'CAPTCHA_WRONG'", to: "email" }, { when: "recover.result.code == 'NOT_FOUND'", to: "not-found" }]),
    },
    {
      id: "found", title: L("Forgot sign in credentials", "نسيت بيانات الدخول"),
      blocks: [
        text(L("Welcome back, {{recover.result.firstName}}!", "أهلاً بعودتك، {{recover.result.firstName}}!"), "title"),
        text(L("We found you with username: {{recover.result.username}}", "وجدنا ملفك الشخصي باسم المستخدم: {{recover.result.username}}")),
        { type: "menu", visibleWhen: "recover.result.status == 'ACTIVE'", items: [
          { id: "signin", label: L("Sign in as {{recover.result.username}}", "تسجيل الدخول باسم {{recover.result.username}}"), icon: "user", actions: [{ type: "exit" }] },
        ] },
        { type: "divider", label: L("OR", "أو"), visibleWhen: "recover.result.status == 'ACTIVE'" },
        { type: "menu", visibleWhen: "recover.result.status == 'ACTIVE'", items: [
          { id: "reset", label: L("Reset your password", "إعادة تعيين كلمة المرور"), icon: "refresh", actions: [go("channel")] },
        ] },
        { type: "menu", visibleWhen: "recover.result.status == 'NEW'", items: [
          { id: "regen", label: L("Send me a new activation code", "أرسل لي رمز تفعيل جديد"), icon: "rocket", actions: [{ type: "callApi", integration: "regenerate", saveAs: "regen", onError: { showToast: L("We couldn't send a code. Try again.", "تعذّر إرسال الرمز. حاول مرة أخرى.") } }, go("regenerated")] },
        ] },
      ],
    },
    {
      id: "channel", title: L("Security code", "رمز الأمان"),
      blocks: [
        text(L("Where should we send your security code?", "أين نرسل رمز الأمان؟"), "title"),
        { type: "select", bind: "recover.channel", label: L("Send the code by", "إرسال الرمز عبر"), choices: [{ id: "sms", label: L("Text message to {{recover.result.maskedPhone}}", "رسالة نصية إلى {{recover.result.maskedPhone}}") }, { id: "email", label: L("Email to {{recover.result.maskedEmail}}", "بريد إلكتروني إلى {{recover.result.maskedEmail}}") }] },
        button(L("Send code", "إرسال الرمز"), [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "{{recover.channel}}" }, saveAs: "ctx.otp", onError: { showToast: L("We couldn't send a code. Try again.", "تعذّر إرسال الرمز. حاول مرة أخرى.") } }, go("otp")]),
      ],
    },
    {
      id: "otp", title: L("Security code", "رمز الأمان"),
      blocks: [
        { type: "otp", bind: "otp.code", length: 6, resendAfterSeconds: 30, hint: L("Please enter the 6-digit security code we sent to {{ctx.otp.maskedPhone}}", "يرجى إدخال رمز الأمان المكوّن من 6 أرقام الذي أرسلناه إلى {{ctx.otp.maskedPhone}}"), onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "{{recover.channel}}" }, saveAs: "ctx.otp" }] },
        button(L("Verify", "تحقق"), [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: L("Incorrect code", "الرمز غير صحيح"), lockAfter: 3, lockTo: "otp-locked" } },
          go("new-password"),
        ]),
      ],
    },
    {
      id: "new-password", title: L("Change Password", "تغيير كلمة المرور"),
      onEnter: [{ type: "callApi", integration: "policy", saveAs: "policy" }],
      blocks: [
        ...passwordFields("recover.password", "recover.confirm"),
        alert("error", L("The two passwords don't match.", "كلمتا المرور غير متطابقتين."), "reset.result.code == 'MISMATCH'"),
        alert("error", L("That password doesn't meet the security requirements.", "كلمة المرور لا تستوفي متطلبات الأمان."), "reset.result.code == 'POLICY'"),
        button(L("Continue", "متابعة"), [
          { type: "validate" },
          { type: "callApi", integration: "resetPassword", input: { password: "{{recover.password}}", confirm: "{{recover.confirm}}" }, saveAs: "reset.result", onError: { showToast: L("We couldn't update your password. Try again.", "تعذّر تحديث كلمة المرور. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "reset.result.ok", to: "reset-done" }]),
    },
    end("reset-done", L("Password updated", "تم تحديث كلمة المرور"), [
      result("success", L("Your password has been successfully updated", "تم تحديث كلمة المرور بنجاح"), L("Your current session is closed. Please sign in again using your new password.", "تم إغلاق جلستك الحالية. يرجى تسجيل الدخول مرة أخرى باستخدام كلمة المرور الجديدة.")),
      button(L("Sign in", "تسجيل الدخول"), [{ type: "exit" }]),
    ]),
    end("regenerated", L("Activation code sent", "تم إرسال رمز التفعيل"), [
      result("success", L("A new activation code is on its way", "رمز تفعيل جديد في الطريق إليك"), L("We sent it to {{regen.maskedEmail}} and {{regen.maskedPhone}}. Use Activate your profile with it.", "أرسلناه إلى {{regen.maskedEmail}} و{{regen.maskedPhone}}. استخدمه في تفعيل ملفك الشخصي.")),
      done,
    ]),
    end("otp-locked", L("Too many attempts", "محاولات كثيرة"), [
      result("error", L("Too many incorrect codes", "عدد كبير من الرموز غير الصحيحة"), L("For your security, your profile is locked for 30 minutes. Try again later.", "حفاظاً على أمانك، تم قفل ملفك الشخصي لمدة 30 دقيقة. حاول لاحقاً.")),
      done,
    ]),
    end("not-found", L("Profile not found", "لم يتم العثور على الملف"), [
      result("error", L("We couldn't find a matching profile", "لم نعثر على ملف شخصي مطابق"), L("Check the email, phone number and birth date, or call support.", "تحقق من البريد الإلكتروني ورقم الهاتف وتاريخ الميلاد أو اتصل بالدعم.")),
      button(L("Try again", "حاول مرة أخرى"), [go("email")]), done,
    ]),
  ],
};

/* =========================================================== 8. Locate us */
export const locateUs: Journey = {
  ...base, id: "jrn_cab_locate_us", slug: "locate-us", name: L("Locate us", "مواقعنا"), entryScreen: "search",
  dataModel: { "loc.kind": { type: "string" }, "loc.range": { type: "string" }, "loc.query": { type: "string" }, "loc.selected": { type: "string", required: true } },
  integrations: [{ id: "locations", adapter: "cab.locations.search", mode: "sandbox" }, { id: "locationDetail", adapter: "cab.locations.details", mode: "sandbox" }],
  screens: [
    {
      id: "search", title: L("Locate us", "مواقعنا"),
      onEnter: [{ type: "setData", path: "loc.kind", value: "branch" }, { type: "setData", path: "loc.range", value: "5" }],
      blocks: [
        text(L("Find a branch or ATM", "ابحث عن فرع أو صراف آلي"), "title"),
        { type: "select", bind: "loc.kind", label: L("Show", "عرض"), choices: [{ id: "branch", label: L("Branches", "الفروع") }, { id: "atm", label: L("ATM", "الصراف الآلي") }, { id: "all", label: L("All", "الكل") }] },
        { type: "select", bind: "loc.range", label: L("Select search range", "اختر نطاق البحث"), choices: ["5", "10", "25", "50", "100"].map((n) => ({ id: n, label: L(`${n} miles`, `${n} ميلاً`) })) },
        input("loc.query", L("Search", "بحث"), { placeholder: L("Search by zip code, city, street", "ابحث بالرمز البريدي أو المدينة أو الشارع") }),
        button(L("Search", "بحث"), [
          { type: "callApi", integration: "locations", input: { kind: "{{loc.kind}}", rangeMiles: "{{loc.range}}", query: "{{loc.query}}" }, saveAs: "loc.found", onError: { showToast: L("We couldn't search right now. Try again.", "تعذّر البحث الآن. حاول مرة أخرى.") } },
          { type: "navigate" },
        ]),
      ],
      navigation: route([{ when: "len(loc.found) == 0", to: "none" }, { when: "len(loc.found) > 0", to: "results" }]),
    },
    {
      id: "results", title: L("{{loc.kind == 'atm' ? 'ATM' : (loc.kind == 'branch' ? 'Branches' : 'All')}}", "{{loc.kind == 'atm' ? 'الصراف الآلي' : (loc.kind == 'branch' ? 'الفروع' : 'الكل')}}"),
      blocks: [
        text(L("{{len(loc.found)}} location(s) found", "تم العثور على {{len(loc.found)}} موقع"), "title"),
        { type: "select", bind: "loc.selected", label: L("Choose a location", "اختر موقعاً"), source: "loc.found", variant: "rows" },
        button(L("View details", "عرض التفاصيل"), [{ type: "validate" }, { type: "callApi", integration: "locationDetail", input: { id: "{{loc.selected}}" }, saveAs: "loc.detail", onError: { showToast: L("We couldn't load that location.", "تعذّر تحميل هذا الموقع.") } }, go("details")]),
        button(L("Change filters", "تغيير عوامل التصفية"), [go("search")], "secondary"),
      ],
    },
    {
      id: "none", title: L("No locations", "لا توجد مواقع"),
      blocks: [
        result("error", L("No locations found", "لم يتم العثور على مواقع"), L("Try a wider range or a different search.", "جرّب نطاقاً أوسع أو بحثاً مختلفاً.")),
        button(L("Search again", "ابحث مرة أخرى"), [go("search")]),
      ],
    },
    {
      id: "details", title: L("Locate us", "مواقعنا"), kind: "terminal",
      blocks: [
        text(L("{{loc.detail.name ? loc.detail.name : 'Location'}}", "{{loc.detail.name ? loc.detail.name : 'الموقع'}}"), "title"),
        { type: "reviewSummary", rows: [
          { label: L("Status", "الحالة"), value: "{{loc.detail.status}}" }, { label: L("Distance", "المسافة"), value: "{{loc.detail.distanceKm}} km" },
          { label: L("Address", "العنوان"), value: "{{loc.detail.address}}" }, { label: L("Hours", "ساعات العمل"), value: "{{loc.detail.hours}}" },
          { label: L("Services", "الخدمات"), value: "{{loc.detail.services}}" },
        ] },
        button(L("Call us", "اتصل بنا"), [{ type: "showToast", text: L("Calling {{loc.detail.phone}}…", "جارٍ الاتصال بـ {{loc.detail.phone}}…") }]),
        button(L("Back to results", "العودة إلى النتائج"), [go("results")], "secondary"),
        done,
      ],
    },
  ],
};

/* ============================================================== 9. Support */
const qa = (id: string, title: ReturnType<typeof L>, items: [ReturnType<typeof L>, ReturnType<typeof L>][]) => ({
  id, title,
  text: L(items.map(([q, a]) => `${q.en}\n${a.en}`).join("\n\n"), items.map(([q, a]) => `${q.ar}\n${a.ar}`).join("\n\n")),
});
export const support: Journey = {
  ...base, id: "jrn_cab_support", slug: "support", name: L("Support", "الدعم"), entryScreen: "home",
  dataModel: {},
  integrations: [],
  screens: [
    {
      id: "home", title: L("Support", "الدعم"),
      blocks: [
        { type: "menu", items: [
          { id: "faqs", label: L("FAQs", "الأسئلة الشائعة"), actions: [go("faqs")] },
          { id: "terms", label: L("Terms & Conditions", "الشروط والأحكام"), actions: [go("terms")] },
          { id: "privacy", label: L("Privacy Policy", "سياسة الخصوصية"), actions: [go("privacy")] },
        ] },
        { type: "reviewSummary", rows: [
          { label: L("Monday - Friday", "الاثنين - الجمعة"), value: L("8 am to 10 pm", "8 صباحاً حتى 10 مساءً") }, { label: L("Saturday", "السبت"), value: L("8 am to 6:30 pm", "8 صباحاً حتى 6:30 مساءً") },
        ] },
        button(L("Call Us", "اتصل بنا"), [go("call")]),
      ],
    },
    {
      // one screen, as in the design: six topics that open to show their questions and answers
      id: "faqs", title: L("FAQs", "الأسئلة الشائعة"),
      blocks: [
        { type: "accordion", items: [
          qa("account", L("Account Activity", "نشاط الحساب"), [
            [L("Which account types are listed in the mobile and online banking apps?", "ما أنواع الحسابات المعروضة في تطبيق الهاتف والخدمات المصرفية عبر الإنترنت؟"), L("Savings, checking, credit cards, loans, deposits and lines of credit.", "الحسابات الجارية والتوفير وبطاقات الائتمان والقروض والودائع وخطوط الائتمان.")],
            [L("Why do I see only some of my accounts on the dashboard?", "لماذا أرى بعض حساباتي فقط في لوحة المعلومات؟"), L("Only accounts marked as favorites are listed on the dashboard. Select Show All Accounts to see the rest, and use the star to add or remove favorites.", "تظهر في لوحة المعلومات الحسابات المفضّلة فقط. اختر عرض كل الحسابات لرؤية الباقي، واستخدم النجمة لإضافة المفضلة أو إزالتها.")],
          ]),
          qa("alerts", L("Alerts & Communication", "التنبيهات والتواصل"), [[L("How do I get alerts?", "كيف أحصل على التنبيهات؟"), L("Turn on the alerts you want from Settings, then choose how you receive them.", "فعّل التنبيهات التي تريدها من الإعدادات ثم اختر طريقة استلامها.")]]),
          qa("bills", L("Bill Payments", "دفع الفواتير"), [[L("When is my bill payment processed?", "متى تتم معالجة دفعة الفاتورة؟"), L("Payments made before the daily cut-off are processed the same day.", "تتم معالجة الدفعات التي تُجرى قبل موعد الإغلاق اليومي في اليوم نفسه.")]]),
          qa("cards", L("Cards", "البطاقات"), [[L("How do I freeze my card?", "كيف أجمّد بطاقتي؟"), L("Open the card in the app and choose Freeze. You can unfreeze it any time.", "افتح البطاقة في التطبيق واختر تجميد. يمكنك إلغاء التجميد في أي وقت.")]]),
          qa("p2p", L("Person-To-Person", "من شخص إلى شخص"), [[L("How do I send money to a person?", "كيف أرسل أموالاً إلى شخص؟"), L("Choose Transfers, pick the person and the amount, then confirm with a one-time code.", "اختر التحويلات ثم الشخص والمبلغ وأكّد برمز لمرة واحدة.")]]),
          qa("profile", L("Profile Management", "إدارة الملف الشخصي"), [[L("How do I change my password?", "كيف أغيّر كلمة المرور؟"), L("Go to Settings, then Change Password, and follow the steps.", "انتقل إلى الإعدادات ثم تغيير كلمة المرور واتبع الخطوات.")]]),
        ] },
        text(L("Sample answers: the bank's content team replaces these with approved text.", "إجابات تجريبية: سيستبدلها فريق المحتوى في البنك بنص معتمد."), "caption"),
        button(L("Back", "رجوع"), [go("home")], "secondary"),
      ],
    },
    {
      id: "terms", title: L("Terms & Conditions", "الشروط والأحكام"),
      blocks: [
        text(L("Using Cairo Amman Bank digital banking means you accept these terms. You are responsible for keeping your username, password and one-time codes private, and for telling the bank at once if you think someone else knows them.", "باستخدامك الخدمات المصرفية الرقمية لبنك القاهرة عمّان فإنك توافق على هذه الشروط. أنت مسؤول عن الحفاظ على سرية اسم المستخدم وكلمة المرور والرموز لمرة واحدة، وعن إبلاغ البنك فوراً إذا اعتقدت أن شخصاً آخر يعرفها.")),
        text(L("Sample text: the bank's approved terms replace this.", "نص تجريبي: ستحل محله الشروط المعتمدة من البنك."), "caption"),
        button(L("Back", "رجوع"), [go("home")], "secondary"), done,
      ],
    },
    {
      id: "privacy", title: L("Privacy Policy", "سياسة الخصوصية"),
      blocks: [
        text(L("At CAB, safeguarding your account information is our top priority. We use encryption, firewalls and secure transmission to keep your information confidential, and we keep you informed about current security issues.", "في بنك القاهرة عمّان، تُعد حماية معلومات حسابك أولويتنا القصوى. نستخدم التشفير وجدران الحماية والنقل الآمن للحفاظ على سرية معلوماتك، ونبقيك على اطلاع بمستجدات الأمان.")),
        text(L("Sample text: the bank's approved policy replaces this.", "نص تجريبي: ستحل محله السياسة المعتمدة من البنك."), "caption"),
        button(L("Back", "رجوع"), [go("home")], "secondary"), done,
      ],
    },
    {
      id: "call", title: L("Call us", "اتصل بنا"), kind: "terminal",
      blocks: [
        result("success", L("+96112025050", "+96112025050"), L("Monday to Friday 8 am to 10 pm, Saturday 8 am to 6:30 pm", "من الاثنين إلى الجمعة 8 صباحاً حتى 10 مساءً، والسبت 8 صباحاً حتى 6:30 مساءً")),
        button(L("Call", "اتصال"), [{ type: "showToast", text: L("Calling the bank…", "جارٍ الاتصال بالبنك…") }]),
        button(L("Back", "رجوع"), [go("home")], "secondary"), done,
      ],
    },
  ],
};

export const cabJourneys: Journey[] = [signIn, defaultSignIn, accountPreview, changeLanguage, enroll, activateProfile, cantSignIn, locateUs, support];
