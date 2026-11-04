import type { Journey } from "../schema";
import { sendMoneyAlias } from "./send-money-alias";
import { internalTransferAcceptance, internalTransferScenarios } from "./internal-transfer-tests";

/** To a BankWorkx® customer (BankWorkx, Payments): an alias of Send money with the type already chosen (the option opt.typeInternal switches it off). It exists so that links to the old name open the right place. */
export const internalTransfer: Journey = sendMoneyAlias({ type: "internal", option: "typeInternal", title: "To a BankWorkx® customer", id: "jrn_internal_transfer", slug: "internal-transfer", acceptance: internalTransferAcceptance, scenarios: internalTransferScenarios });
