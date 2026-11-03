import type { Journey } from "../schema";

/**
 * Sign-in help journeys for a corporate web bank, rebuilt from a Temenos Digital Banking R26 sign-in flow: can't sign in, enroll, activate.
 * They run before anyone is signed in, so they only use the sandbox identity services (auth.*). English only for now.
 */
const base = { version: 1, status: "published" as const, channels: ["web" as const], apps: ["acme-corporate"], locale: { default: "en", supported: ["en"] } };
/** The password policy of the sandbox bank, as the one regular expression a text field can check. */
const PASSWORD = "^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,20}$";
const PASSWORD_HELP = "8 to 20 characters, with an upper-case letter, a lower-case letter, a number and a symbol.";
const DATE = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";
const captchaBlocks = [
  { type: "text" as const, variant: "caption" as const, text: "Type the characters shown below" },
  { type: "text" as const, variant: "title" as const, text: "{{ctx.captcha.text}}" },
  { type: "textInput" as const, bind: "captcha.value", label: "Characters shown above", placeholder: "Enter the above text here" },
];
const captchaOnEnter = [{ type: "callApi" as const, integration: "captcha", saveAs: "ctx.captcha", onError: { showToast: "We could not load the verification text. Try again.", stay: true } }];
const back = (label: string, to: string) => ({ type: "button" as const, label, variant: "primary" as const, actions: [{ type: "navigate" as const, to }] });
const close = (label: string) => ({ type: "button" as const, label, variant: "primary" as const, actions: [{ type: "exit" as const }] });

export const cantSignIn: Journey = {
  ...base, id: "jrn_cant_sign_in", slug: "cant-sign-in", name: "Can't sign in", entryScreen: "choose",
  dataModel: {
    "verify.email": { type: "string", required: true }, "verify.mobile": { type: "string", required: true }, "verify.dob": { type: "string", required: true },
    "captcha.value": { type: "string", required: true }, "pick.username": { type: "string" },
    "reset.password": { type: "string", required: true }, "reset.confirm": { type: "string", required: true },
  },
  integrations: [
    { id: "captcha", adapter: "auth.captcha.current", mode: "sandbox" },
    { id: "verifyUser", adapter: "auth.user.verify", mode: "sandbox" },
    { id: "usernames", adapter: "auth.user.usernames", mode: "sandbox" },
    { id: "resetPassword", adapter: "auth.password.reset", mode: "sandbox" },
  ],
  screens: [
    {
      id: "choose", title: "Can't sign in?",
      blocks: [
        { type: "text", variant: "title", text: "Can't sign in?" },
        { type: "text", text: "You can reset your password. We will check your details first, then you can set a new one." },
        { type: "button", label: "Reset password", variant: "primary", actions: [{ type: "navigate", to: "verify" }] },
        { type: "text", variant: "caption", text: "Remember your password? You can sign in with your existing password." },
        { type: "button", label: "Sign in", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "verify", title: "Let's verify it's you", onEnter: captchaOnEnter,
      navigation: { rules: [{ when: "ctx.verified.outcome == 'notfound'", to: "nomatch" }, { when: "ctx.verified.count > 1", to: "username" }] },
      blocks: [
        { type: "stepper", steps: ["verify", "password"] },
        { type: "text", variant: "title", text: "Let's verify it's you" },
        { type: "textInput", bind: "verify.email", label: "Registered email", keyboard: "email", placeholder: "name@company.com", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", patternMessage: "Please enter a valid email address." },
        { type: "textInput", bind: "verify.mobile", label: "Registered mobile number", keyboard: "phone", placeholder: "+44 7700 900123", pattern: "^\\+?[0-9 ]{8,16}$", patternMessage: "Please enter a valid mobile number." },
        { type: "textInput", bind: "verify.dob", label: "Date of birth", placeholder: "YYYY-MM-DD", pattern: DATE, patternMessage: "Please enter a valid date of birth, like 1985-04-12." },
        ...captchaBlocks,
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "verifyUser", input: { email: "{{verify.email}}", mobile: "{{verify.mobile}}", dob: "{{verify.dob}}", captcha: "{{captcha.value}}" }, saveAs: "ctx.verified", onError: { showToast: "Invalid captcha. Please try again.", stay: true } },
            { type: "navigate", to: "password" },
          ],
        },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "nomatch", title: "No match", kind: "branch",
      blocks: [
        { type: "alert", tone: "error", text: "The details you entered don't match our records." },
        back("Try again", "verify"),
      ],
    },
    {
      id: "username", title: "Welcome back",
      onEnter: [{ type: "callApi", integration: "usernames", saveAs: "ctx.usernames", onError: { showToast: "We could not load your usernames. Try again.", stay: true } }],
      blocks: [
        { type: "text", variant: "title", text: "Welcome back" },
        { type: "select", bind: "pick.username", label: "Select your username", source: "ctx.usernames" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "navigate", to: "password" }] },
      ],
    },
    {
      id: "password", title: "Set your password",
      blocks: [
        { type: "stepper", steps: ["verify", "password"] },
        { type: "text", variant: "title", text: "Set your password" },
        { type: "text", variant: "caption", text: PASSWORD_HELP },
        { type: "textInput", bind: "reset.password", label: "New password", secure: true, pattern: PASSWORD, patternMessage: "Your new password does not meet the required criteria." },
        { type: "textInput", bind: "reset.confirm", label: "Confirm password", secure: true },
        {
          type: "button", label: "Set password", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "resetPassword", input: { serviceKey: "{{ctx.verified.serviceKey}}", username: "{{pick.username}}", password: "{{reset.password}}", confirm: "{{reset.confirm}}" }, onError: { showToast: "Passwords do not match. Please try again.", stay: true } },
            { type: "navigate", to: "done" },
          ],
        },
      ],
    },
    {
      id: "done", title: "Password reset", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "You have successfully reset your password", text: "Please sign in to access your banking services." },
        close("Sign in"),
      ],
    },
  ],
};

export const enroll: Journey = {
  ...base, id: "jrn_enroll", slug: "enroll", name: "Enroll", entryScreen: "entity",
  dataModel: {
    "enroll.entity": { type: "string", required: true }, "enroll.taxId": { type: "string", required: true }, "enroll.lastName": { type: "string", required: true },
    "enroll.dob": { type: "string", required: true }, "captcha.value": { type: "string", required: true },
  },
  integrations: [
    { id: "legalEntities", adapter: "auth.legalEntities.list", mode: "sandbox" },
    { id: "captcha", adapter: "auth.captcha.current", mode: "sandbox" },
    { id: "enrollVerify", adapter: "auth.enroll.verify", mode: "sandbox" },
  ],
  screens: [
    {
      id: "entity", title: "Select your company",
      onEnter: [{ type: "callApi", integration: "legalEntities", saveAs: "ctx.legalEntities", onError: { showToast: "We could not load the companies. Try again.", stay: true } }],
      blocks: [
        { type: "stepper", steps: ["entity", "details"] },
        { type: "text", variant: "title", text: "Enroll now" },
        { type: "text", text: "Select the company you want to create your digital banking profile for." },
        { type: "select", bind: "enroll.entity", label: "Company", source: "ctx.legalEntities", variant: "tiles" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "details" }] },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "details", title: "User details", onEnter: captchaOnEnter,
      navigation: { rules: [{ when: "ctx.enrolled.outcome == 'already'", to: "already" }, { when: "ctx.enrolled.outcome == 'notfound'", to: "cant" }] },
      blocks: [
        { type: "stepper", steps: ["entity", "details"] },
        { type: "text", variant: "title", text: "User details" },
        { type: "textInput", bind: "enroll.taxId", label: "Tax ID", placeholder: "000-00-0000", pattern: "^[0-9-]{9,11}$", patternMessage: "Please enter a valid Tax ID." },
        { type: "textInput", bind: "enroll.lastName", label: "Last name" },
        { type: "textInput", bind: "enroll.dob", label: "Date of birth", placeholder: "YYYY-MM-DD", pattern: DATE, patternMessage: "Please enter a valid date of birth, like 1985-04-12." },
        ...captchaBlocks,
        {
          type: "button", label: "Proceed", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "enrollVerify", input: { taxId: "{{enroll.taxId}}", lastName: "{{enroll.lastName}}", dob: "{{enroll.dob}}", captcha: "{{captcha.value}}" }, saveAs: "ctx.enrolled", onError: { showToast: "Looks like you've entered incorrect captcha - try again", stay: true } },
            { type: "navigate", to: "done" },
          ],
        },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "done", title: "Enrolled", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "You have successfully enrolled to corporate banking", text: "Your user ID and an activation code have been sent to your registered email and mobile number. Please activate your profile to start using corporate banking." },
        close("Done"),
      ],
    },
    {
      id: "already", title: "Already enrolled", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You are already enrolled", text: "Please sign in to continue." },
        close("Sign in"),
      ],
    },
    {
      id: "cant", title: "Can't enroll", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't enroll you", text: "Looks like we haven't found relevant information. Kindly contact the bank administrator to know more details." },
        back("Try again", "entity"),
      ],
    },
  ],
};

export const activateProfile: Journey = {
  ...base, id: "jrn_activate_profile", slug: "activate-profile", name: "Activate your profile", entryScreen: "details",
  dataModel: {
    "activate.username": { type: "string", required: true }, "activate.code": { type: "string", required: true },
    "reset.password": { type: "string", required: true }, "reset.confirm": { type: "string", required: true },
  },
  integrations: [
    { id: "verifyActivation", adapter: "auth.activation.verify", mode: "sandbox" },
    { id: "activate", adapter: "auth.activation.setPassword", mode: "sandbox" },
  ],
  screens: [
    {
      id: "details", title: "Activate your profile",
      navigation: { rules: [{ when: "ctx.activation.outcome == 'blocked'", to: "blocked" }, { when: "ctx.activation.outcome == 'expired'", to: "expired" }, { when: "ctx.activation.outcome == 'invalid'", to: "invalid" }] },
      blocks: [
        { type: "stepper", steps: ["details", "password"] },
        { type: "text", variant: "title", text: "Activate your profile" },
        { type: "text", text: "Please enter the username and activation code that were sent to your email and phone." },
        { type: "textInput", bind: "activate.username", label: "Username" },
        { type: "textInput", bind: "activate.code", label: "Activation code", secure: true },
        {
          type: "button", label: "Verify", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "verifyActivation", input: { username: "{{activate.username}}", code: "{{activate.code}}" }, saveAs: "ctx.activation", onError: { showToast: "We could not check the code. Try again.", stay: true } },
            { type: "navigate", to: "password" },
          ],
        },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    { id: "invalid", title: "Check your details", kind: "branch", blocks: [{ type: "alert", tone: "error", text: "You've entered an incorrect username or activation code." }, back("Try again", "details")] },
    { id: "blocked", title: "Code blocked", kind: "branch", blocks: [{ type: "alert", tone: "error", text: "Your activation code is blocked. Please select \"Can't sign in\" to regenerate a new activation code." }, back("Back", "details")] },
    { id: "expired", title: "Code expired", kind: "branch", blocks: [{ type: "alert", tone: "error", text: "Your activation code has expired. Please select \"Can't sign in\" to regenerate a new activation code." }, back("Back", "details")] },
    {
      id: "password", title: "Set your password",
      blocks: [
        { type: "stepper", steps: ["details", "password"] },
        { type: "text", variant: "title", text: "Set your password" },
        { type: "text", text: "Please create your password in order to access your new online bank account." },
        { type: "text", variant: "caption", text: PASSWORD_HELP },
        { type: "textInput", bind: "reset.password", label: "Password", secure: true, pattern: PASSWORD, patternMessage: "Invalid password" },
        { type: "textInput", bind: "reset.confirm", label: "Confirm password", secure: true },
        {
          type: "button", label: "Set password", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "activate", input: { serviceKey: "{{ctx.activation.serviceKey}}", password: "{{reset.password}}", confirm: "{{reset.confirm}}" }, onError: { showToast: "Passwords do not match. Please try again.", stay: true } },
            { type: "navigate", to: "done" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "details" }] },
      ],
    },
    {
      id: "done", title: "Profile activated", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "We have activated your profile successfully" }, close("Let's get started")],
    },
  ],
};

export const corporateJourneys: Journey[] = [cantSignIn, enroll, activateProfile];
