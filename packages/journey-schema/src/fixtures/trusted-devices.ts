import type { Journey, Screen } from "../schema";
import { trustedDevicesAcceptance, trustedDevicesScenarios } from "./trusted-devices-tests";
import { alert, button, commonScreens, failRules, go, needsPermission, route, set, text } from "./security-kit";

/** The code is the only thing this journey holds while it is being sent. */
const wipe = [set("td.code", "")];
const removeCall = { type: "callApi" as const, integration: "removeDevice", saveAs: "td.res", onError: { navigate: "removeFail" } };

/**
 * Trusted devices (BankWorkx, Signing in and security, Settings > Security). A view, not a form: the devices that skip the new-device code,
 * and for each other device a Remove that asks for a one-time code first, and one "Sign out other devices". The device in hand is never
 * removed here. Three wrong codes close the panel and lock the buttons until the person leaves and comes back.
 *
 * Built from the spec of the prototype with the blocks FinX has: a row is a tap that opens the panel (not a Remove button on the right of
 * the row), and the panel is a screen of its own under the list's title.
 */
export const trustedDevices: Journey = {
  id: "jrn_bankworkx_trusted_devices",
  slug: "trusted-devices",
  name: "Trusted devices",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: trustedDevicesAcceptance,
  scenarios: trustedDevicesScenarios,
  dataModel: {
    "opt.limit": { type: "boolean" },
    "opt.signOutAll": { type: "boolean" },
    "td.code": { type: "string", required: true },
    "td.codeError": { type: "string" },
    "td.wrong": { type: "number" },
    "td.pick": { type: "string" },
    "td.pickName": { type: "string" },
    "td.pickCurrent": { type: "string" },
    "td.all": { type: "boolean" },
    "td.locked": { type: "boolean" },
    "td.stale": { type: "boolean" },
    "td.gone": { type: "boolean" },
    "td.notice": { type: "string" },
  },
  integrations: [
    { id: "devices", adapter: "bank.devices.list", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "removeDevice", adapter: "bank.devices.remove", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Trusted devices", kind: "branch",
      onEnter: [...wipe, set("td.codeError", ""), set("td.wrong", 0), set("td.locked", false), set("td.stale", false), set("td.gone", false), set("td.all", false), set("td.res", null), set("td.notice", ""), go("list")],
      navigation: route([needsPermission, "denied"]),
      blocks: [],
    },
    {
      id: "list", title: "Trusted devices",
      onEnter: [
        { type: "callApi", integration: "devices", saveAs: "td.list", onError: { navigate: "fail" } },
        ...wipe, set("td.codeError", ""), set("td.wrong", 0), set("td.pick", ""), set("td.pickCurrent", ""),
      ],
      blocks: [
        text("Trusted devices", "title"),
        text("{{td.list.count}} of {{td.list.max}}", "caption", "opt.limit != false"),
        alert("success", "{{td.notice}}", "td.notice"),
        alert("warning", "Some details may be out of date.", "td.stale"),
        alert("error", "Too many wrong codes. Try again later.", "td.locked"),
        alert("info", "That device is already gone.", "td.gone"),
        text("No trusted devices", "title", "td.list.count == 0"),
        text("Devices you trust will show here.", "body", "td.list.count == 0"),
        {
          type: "menu", source: "td.list.items",
          item: {
            label: "{{item.name}}",
            text: "{{item.current ? 'This device · ' : ''}}Last used {{item.lastUsedText}}{{item.current ? '' : ' · Tap to remove'}}",
            icon: "phone",
            actions: [set("td.notice", ""), set("td.pick", "{{item.id}}"), set("td.pickName", "{{item.name}}"), set("td.pickCurrent", "{{item.current}}"), set("td.all", false), { type: "navigate" }],
          },
        },
        button("Sign out other devices", [set("td.notice", ""), set("td.all", true), set("td.pick", ""), go("sendCode")], "secondary", "opt.signOutAll != false && td.list.others > 0 && !td.locked"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
      // the device in hand cannot be removed here, and once the view is locked no row opens
      navigation: route(["!td.locked && td.pickCurrent == 'false' && td.pick", "sendCode"]),
    },
    {
      id: "sendCode", title: "Trusted devices", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms", strict: true }, saveAs: "td.otp", onError: { navigate: "codeFail" } },
        ...wipe, set("td.codeError", ""), set("td.wrong", 0),
        go("remove"),
      ],
      blocks: [],
    },
    {
      id: "remove", title: "{{td.all ? 'Sign out other devices?' : 'Remove ' + td.pickName + '?'}}",
      blocks: [
        text("{{td.all ? 'Sign out other devices?' : 'Remove ' + td.pickName + '?'}}", "title"),
        text("It will ask for a code next time it signs in.", "body", "!td.all"),
        text("Every other device is signed out and asks for a code next time.", "body", "td.all"),
        alert("error", "That code isn’t right. {{3 - td.wrong}} {{td.wrong == 2 ? 'try' : 'tries'}} left.", "td.codeError == 'OTP_INVALID'"),
        alert("error", "That code has expired. Cancel and start again.", "td.codeError == 'OTP_EXPIRED'"),
        // an otp block, as in the other journeys that ask for a code: the lint finds the code screen by it
        { type: "otp", bind: "td.code", length: 6, hint: "Code sent to the phone ending {{td.otp.last4}}", visibleWhen: "td.codeError != 'OTP_EXPIRED'" },
        button("Remove", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{td.code}}", strict: true }, onError: { navigate: "codeFail" } },
          set("td.code", ""),
          { ...removeCall, input: { deviceId: "{{td.pick}}" } },
          set("td.notice", "Device removed"),
          go("list"),
        ], "primary", "!td.all && td.codeError != 'OTP_EXPIRED'"),
        button("Sign out", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{td.code}}", strict: true }, onError: { navigate: "codeFail" } },
          set("td.code", ""),
          { ...removeCall, input: { all: true } },
          set("td.notice", "Other devices signed out"),
          go("list"),
        ], "primary", "td.all && td.codeError != 'OTP_EXPIRED'"),
        button("Cancel", [...wipe, go("list")], "ghost"),
      ],
    },
    {
      // a code that did not work: what it says, and the third wrong one closes the panel and locks the buttons
      id: "codeFail", title: "Trusted devices", kind: "branch",
      onEnter: [
        ...wipe,
        set("td.codeError", "{{ctx.error.code}}"),
        set("td.wrong", "{{ctx.error.code == 'OTP_INVALID' ? td.wrong + 1 : td.wrong}}"),
        set("td.locked", "{{ctx.error.code == 'OTP_LOCKED' ? true : td.locked}}"),
        go("remove"),
      ],
      navigation: route(["ctx.error.code == 'OTP_LOCKED'", "list"], ["ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'OTP_EXPIRED'", "problem"]),
      blocks: [],
    },
    {
      // the bank did not remove it: nothing was changed, the list may be out of date, and a new code is needed to try again
      id: "removeFail", title: "Trusted devices", kind: "branch",
      onEnter: [...wipe, set("td.stale", true), set("td.gone", "{{ctx.error.code == 'DEVICE_NOT_FOUND'}}"), go("removeProblem")],
      navigation: route(...failRules, ["ctx.error.code == 'DEVICE_NOT_FOUND'", "list"]),
      blocks: [],
    },
    {
      id: "removeProblem", title: "Trusted devices",
      blocks: [
        alert("error", "This isn’t available right now. Nothing was changed.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("sendCode")]),
        button("Cancel", [go("list")], "ghost"),
      ],
    },
    {
      id: "fail", title: "Trusted devices", kind: "branch",
      onEnter: [...wipe, go("problem")],
      blocks: [],
    },
    ...commonScreens("Trusted devices", wipe),
  ] as Screen[],
};
