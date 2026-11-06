import type { Journey } from "../schema";
import { ownTransfer } from "./own-transfer";
import { updateProfile } from "./update-profile";
import { newMessage } from "./new-message";
import { connectAccount } from "./connect-account";
import { messagesView } from "./messages";
import { serviceRequest } from "./service-request";
import { myRequests } from "./my-requests";
import { manageBeneficiary } from "./manage-beneficiary";
import { personalTransfer } from "./personal-transfer";
import { internalTransfer } from "./internal-transfer";
import { internationalTransfer } from "./international-transfer";
import { payBillBankworkx } from "./pay-bill-bankworkx";
import { mobileTopup } from "./mobile-topup";
import { schedulePayment } from "./schedule-payment";
import { cancelStandingOrder } from "./cancel-standing-order";
import { supplierPayment } from "./supplier-payment";
import { approvePayments } from "./approve-payments";
import { signIn } from "./sign-in";
import { forgotUsername } from "./forgot-username";
import { resetPassword } from "./reset-password";
import { forgotPassword } from "./forgot-password";
import { unlockAccount } from "./unlock-account";
import { changePassword } from "./change-password";
import { trustedDevices } from "./trusted-devices";
import { changeQuickPin } from "./change-quick-pin";
import { setupQuickLogin } from "./setup-quick-login";
import { accounts } from "./accounts";
import { accountDetails } from "./account-details";
import { statement } from "./statement";
import { openAnotherAccount } from "./open-another-account";
import { createBudget } from "./create-budget";
import { budgets } from "./budgets";
import { transferTypes } from "./transfer-types";
import { accountNickname } from "./account-nickname";
import { singleTransfer } from "./single-transfer";
import { addCard } from "./add-card";
export { addCard };
import { disputeTransaction } from "./dispute-transaction";
import { replaceCard } from "./replace-card";
import { virtualCard } from "./virtual-card";
import { freezeCard } from "./freeze-card";
import { cardControls } from "./card-controls";
import { activateCard } from "./activate-card";
import { cardsView } from "./cards";
import { cardPin } from "./card-pin";
import { addMoney } from "./add-money";
import { invest } from "./invest";
import { sellInvestment } from "./sell-investment";
import { termDeposit } from "./term-deposit";
import { saveBorrow } from "./save-borrow";
import { savingsGoal } from "./savings-goal";
import { applyLoan } from "./apply-loan";
import { repayLoan } from "./repay-loan";
export { addMoney, invest, sellInvestment };

// Create a budget is its own file (accounts and budgets belong together); it is still exported from here, where it always was
export { createBudget };

/** Journeys for the BankWorkx app. English only for now; the app filters them out of other banks' apps with `apps`. */
const base = { version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] } };
const done = { type: "button" as const, label: "Done", variant: "primary" as const, actions: [{ type: "exit" as const }] };


// Connect a bank was rebuilt for step 7, slice D (see connect-account.ts); the old journey asked for the other bank's username and password
export { connectAccount };



export const bankworkxJourneys: Journey[] = [addMoney, addCard, connectAccount, createBudget, invest, sellInvestment, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer, internationalTransfer, payBillBankworkx, mobileTopup, schedulePayment, cancelStandingOrder, supplierPayment, approvePayments, signIn, forgotUsername, resetPassword, forgotPassword, unlockAccount, changePassword, trustedDevices, changeQuickPin, setupQuickLogin, accounts, accountDetails, statement, openAnotherAccount, budgets, accountNickname, transferTypes, singleTransfer, cardsView, activateCard, cardControls, freezeCard, virtualCard, replaceCard, cardPin, disputeTransaction, saveBorrow, termDeposit, savingsGoal, applyLoan, repayLoan, updateProfile, newMessage, messagesView, serviceRequest, myRequests];
