import type { Journey } from "../schema";
import { resetAlias } from "./reset-alias";
import { unlockAccountAcceptance, unlockAccountScenarios } from "./unlock-account-tests";

/** Unlock account (BankWorkx, Signing in and security): an alias of Reset password in its unlock mode. The code, then the profile is unlocked and the password stays. The option allowUnlock of Reset password switches it off. */
export const unlockAccount: Journey = resetAlias({
  mode: "unlock", option: "allowUnlock", title: "Unlock account", offTitle: "Unlocking isn’t available", offText: "You can reset your password instead.",
  id: "jrn_bankworkx_unlock_account", slug: "unlock-account", acceptance: unlockAccountAcceptance, scenarios: unlockAccountScenarios,
});
