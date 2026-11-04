import type { Journey } from "../schema";
import { sendMoneyAlias } from "./send-money-alias";
import { internationalTransferAcceptance, internationalTransferScenarios } from "./international-transfer-tests";

/** Abroad (BankWorkx, Payments): an alias of Send money with the type "To another country" already chosen (the option opt.typeIntl switches it off). It exists so that links to the old name open the right place. */
export const internationalTransfer: Journey = sendMoneyAlias({ type: "international", option: "typeIntl", title: "Abroad", id: "jrn_international_transfer", slug: "international-transfer", acceptance: internationalTransferAcceptance, scenarios: internationalTransferScenarios });
