import type { Block, Screen } from "../schema";

/**
 * The small pieces the Security journeys (change-password, trusted-devices, setup-quick-login, change-quick-pin) are built from, so each file
 * says what is its own and the four cannot drift apart on the parts every one of them needs: the permission, the step-up, the failure screens.
 */
export const text = (t: string, variant?: "title" | "body" | "caption", visibleWhen?: string): Block => ({ type: "text", text: t, ...(variant ? { variant } : {}), ...(visibleWhen ? { visibleWhen } : {}) });
export const alert = (tone: "info" | "warning" | "error" | "success", t: string, visibleWhen?: string): Block => ({ type: "alert", tone, text: t, ...(visibleWhen ? { visibleWhen } : {}) });
export const button = (label: string, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary", visibleWhen?: string): Block => ({ type: "button", label, variant, actions, ...(visibleWhen ? { visibleWhen } : {}) });
export const go = (to: string) => ({ type: "navigate" as const, to });
export const set = (path: string, value: unknown) => ({ type: "setData" as const, path, value });
export const route = (...rules: [string, string][]) => ({ rules: rules.map(([when, to]) => ({ when, to })) });

/** The journey needs the permission of the signed-in place; a place that has permissions but not this one is sent to `denied`. A place without a list (the picker) is not stopped here: the bank decides. */
export const needsPermission = "!isEmpty(session.permissions) && !has(session.permissions, 'security.manage')";

/** Where a failed bank call goes: the step-up ran out, the bank did not answer, or something else. The caller's own codes are routed before this. */
export const failRules: [string, string][] = [["ctx.error.code == 'STEP_UP_REQUIRED'", "stepup"]];

/** Screens every Security journey has. `wipe` clears what the journey held (a password, a PIN, a code) and `restart` is the screen "Try again" returns to. */
export function commonScreens(title: string, wipe: any[], restart = "start"): Screen[] {
  return [
    {
      id: "denied", title: "Not available", kind: "terminal", onEnter: wipe,
      blocks: [{ type: "result", tone: "error", title: "Not available", text: "This isn’t available for your profile." }, button("Done", [{ type: "exit" }])],
    },
    {
      // the step-up (the password, then a code) lasts five minutes: when it has run out the person confirms again and opens this again
      id: "stepup", title, kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Confirm it’s you first", text: "For your security, confirm it’s you first. Nothing was changed. Close this and open it again." },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "problem", title, onEnter: wipe,
      blocks: [
        alert("error", "This isn’t available right now. Nothing was changed. Try again in a few minutes.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go(restart)]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
  ];
}

/** The bank's number for "Contact support" (the sandbox has no contact journey). */
export const CALL_US = "Call us on +1 800 555 0100 (sandbox number).";
