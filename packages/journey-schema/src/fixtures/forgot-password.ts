import type { Journey } from "../schema";
import { resetAlias } from "./reset-alias";
import { forgotPasswordAcceptance, forgotPasswordScenarios } from "./forgot-password-tests";

/** Forgot password (BankWorkx, Signing in and security): the name that the "Forgot password?" link of Sign in calls. An alias of Reset password in its reset mode, so a bank can place the link under its own name. */
export const forgotPassword: Journey = resetAlias({
  mode: "reset", option: "resetPassword", title: "Forgot password", offTitle: "Resetting a password isn’t available", offText: "Please contact the bank.",
  id: "jrn_bankworkx_forgot_password", slug: "forgot-password", acceptance: forgotPasswordAcceptance, scenarios: forgotPasswordScenarios,
});
