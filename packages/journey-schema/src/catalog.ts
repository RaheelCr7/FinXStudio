import type { Journey } from "./schema";
import { localTransfer } from "./fixtures/local-transfer";
import { payBill } from "./fixtures/pay-bill";
import { payBillBankworkx } from "./fixtures/pay-bill-bankworkx";
import { mobileTopup } from "./fixtures/mobile-topup";
import { schedulePayment } from "./fixtures/schedule-payment";
import { cancelStandingOrder } from "./fixtures/cancel-standing-order";
import { supplierPayment } from "./fixtures/supplier-payment";
import { approvePayments } from "./fixtures/approve-payments";
import { paymentTracker } from "./fixtures/payment-tracker";
import { businessWithdraw } from "./fixtures/business-withdraw";
import { businessSchedules } from "./fixtures/business-schedules";
import { scheduleBusinessPayment } from "./fixtures/schedule-business-payment";
import { templates } from "./fixtures/templates";
import { paymentTemplate } from "./fixtures/payment-template";
import { addSupplier } from "./fixtures/add-supplier";
import { businessStatement } from "./fixtures/business-statement";
import { businessAccounts } from "./fixtures/business-accounts";
import { corporatePayment, corporateApproval } from "./fixtures/corporate-payments";
import { bulkPayment } from "./fixtures/bulk-payment";
import { payrollRun } from "./fixtures/payroll-run";
import { withdrawPayment } from "./fixtures/withdraw-payment";
import { convertCurrency } from "./fixtures/convert-currency";
import { ownTransfer } from "./fixtures/own-transfer";
import { manageBeneficiary } from "./fixtures/manage-beneficiary";
import { personalTransfer } from "./fixtures/personal-transfer";
import { internalTransfer } from "./fixtures/internal-transfer";
import { internationalTransfer } from "./fixtures/international-transfer";
import { addMoney, connectAccount, createBudget, invest, sellInvestment } from "./fixtures/bankworkx";
import { addCard } from "./fixtures/add-card";
import { cabJourneys } from "./fixtures/cab";
import { signIn } from "./fixtures/sign-in";
import { forgotUsername } from "./fixtures/forgot-username";
import { resetPassword } from "./fixtures/reset-password";
import { forgotPassword } from "./fixtures/forgot-password";
import { unlockAccount } from "./fixtures/unlock-account";
import { changePassword } from "./fixtures/change-password";
import { trustedDevices } from "./fixtures/trusted-devices";
import { changeQuickPin } from "./fixtures/change-quick-pin";
import { setupQuickLogin } from "./fixtures/setup-quick-login";
import { accounts } from "./fixtures/accounts";
import { accountDetails } from "./fixtures/account-details";
import { statement } from "./fixtures/statement";
import { accountNickname } from "./fixtures/account-nickname";
import { openAnotherAccount } from "./fixtures/open-another-account";
import { budgets } from "./fixtures/budgets";
import { transferTypes } from "./fixtures/transfer-types";
import { singleTransfer } from "./fixtures/single-transfer";
import { disputeTransaction } from "./fixtures/dispute-transaction";
import { replaceCard } from "./fixtures/replace-card";
import { virtualCard } from "./fixtures/virtual-card";
import { freezeCard } from "./fixtures/freeze-card";
import { cardControls } from "./fixtures/card-controls";
import { activateCard } from "./fixtures/activate-card";
import { cardsView } from "./fixtures/cards";
import { cardPin } from "./fixtures/card-pin";
import { termDeposit } from "./fixtures/term-deposit";
import { saveBorrow } from "./fixtures/save-borrow";
import { savingsGoal } from "./fixtures/savings-goal";
import { applyLoan } from "./fixtures/apply-loan";
import { repayLoan } from "./fixtures/repay-loan";
import { updateProfile } from "./fixtures/update-profile";
import { newMessage } from "./fixtures/new-message";
import { messagesView } from "./fixtures/messages";
import { serviceRequest } from "./fixtures/service-request";
import { myRequests } from "./fixtures/my-requests";
import { loanCalculator } from "./fixtures/loan-calculator";
import { depositCalculator } from "./fixtures/deposit-calculator";
import { findBranchAtm } from "./fixtures/find-branch-atm";
import { contactSupport } from "./fixtures/contact-support";
import { openAccount } from "./fixtures/open-account";
import { trackApplication } from "./fixtures/track-application";
import { registerDigitalBanking } from "./fixtures/register-digital-banking";

/**
 * The journey catalog: ready-made journeys a project can add to its own app.
 * Each entry is the journey exactly as shipped, so adding it never depends on what someone later edited in Studio.
 */
export const CATEGORIES = ["Payments", "Accounts", "Cards", "Budgeting", "Save & Borrow", "Investing", "More", "Public", "Onboarding", "Access"] as const;
export type CatalogCategory = (typeof CATEGORIES)[number];

export type CatalogEntry = {
  /** Same as the journey's slug. */
  id: string;
  category: CatalogCategory;
  /** One line a product owner can read at a glance. */
  summary: string;
  /** What the journey shows off, as short phrases. */
  highlights: string[];
  /** The look the journey was made in, so a new bank knows what it is getting. */
  madeFor: "meezan" | "bankworkx" | "cab";
  journey: Journey;
};

export const catalog: CatalogEntry[] = [
  {
    id: localTransfer.slug, category: "Payments", madeFor: "meezan", journey: localTransfer,
    summary: "Send money to a saved beneficiary, with a daily-limit check, consent and a one-time code.",
    highlights: ["Daily limit rule", "Consent before sending", "One-time code", "English and Urdu"],
  },
  {
    id: payBill.slug, category: "Payments", madeFor: "meezan", journey: payBill,
    summary: "Look up a bill by company and reference, review it and pay from an account.",
    highlights: ["Bill lookup", "Review before paying", "One-time code", "English and Urdu"],
  },
  {
    id: convertCurrency.slug, category: "Accounts", madeFor: "meezan", journey: convertCurrency,
    summary: "Convert money between two of your own accounts in different currencies, with the rate and fee shown before you confirm.",
    highlights: ["Amount in the account's own currency", "Rate and fee on the review", "Rate that expires", "One-time code", "English and Urdu"],
  },
  {
    id: corporatePayment.slug, category: "Payments", madeFor: "meezan", journey: corporatePayment,
    summary: "A company initiator starts a payment to an approved supplier: limits, approvers needed, cut-off, and a one-time code. It then waits for an approver.",
    highlights: ["Only for initiators", "Daily limit shown and checked", "Approved suppliers only", "Cut-off and value date", "One-time code"],
  },
  {
    id: corporateApproval.slug, category: "Payments", madeFor: "meezan", journey: corporateApproval,
    summary: "A company approver reviews what waits for them, approves or rejects. Nobody approves their own; above a threshold a second approver is needed.",
    highlights: ["Only for approvers", "Pending list", "Four eyes", "Second approver above a threshold", "One-time code"],
  },
  {
    id: bulkPayment.slug, category: "Payments", madeFor: "meezan", journey: bulkPayment,
    summary: "A company initiator pays many approved suppliers from a pasted file: every row checked and the failures explained, then sent for approval as one payment.",
    highlights: ["Row by row checks with reasons", "Up to 50 rows", "One payment against the limits", "Approvers needed shown", "One-time code"],
  },
  {
    id: payrollRun.slug, category: "Payments", madeFor: "meezan", journey: payrollRun,
    summary: "A company initiator pays the month's salaries from a pasted file: every row checked against the payroll register and salary cap, one run per pay period, always two approvers.",
    highlights: ["Payroll register and salary cap", "One run per pay period", "Always two approvers", "One payment against the limits", "One-time code"],
  },
  {
    id: withdrawPayment.slug, category: "Payments", madeFor: "meezan", journey: withdrawPayment,
    summary: "The person who started a company payment takes it back while it waits for approval, with a one-time code. Their daily limit is given back.",
    highlights: ["Only your own waiting payments", "Even if one approver has approved", "One-time code", "Limit given back"],
  },
  {
    id: addMoney.slug, category: "Accounts", madeFor: "bankworkx", journey: addMoney,
    summary: "Top up an account from a saved card (10.00 to 5,000.00, with a 1.5% card fee when on, security code, one-time code), or show the account's details to send money from another bank.",
    highlights: ["Card or bank transfer details", "Expired cards cannot be chosen", "Fee and total charged shown before the code", "Details of the home market for a transfer", "Timeout and unavailable screens"],
  },
  {
    id: ownTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: ownTransfer,
    summary: "Move money between your own accounts: instant and free in the same currency; converted at the mid-market rate with a separate 0.20% fee and a rate held for 30 seconds in different currencies.",
    highlights: ["Same-currency move with a note", "Mid-market rate, no margin", "Type what you send or what you get", "Rate that runs out and renews", "One-time code, locked after 3 wrong codes", "Timeout and unavailable screens"],
  },
  {
    id: manageBeneficiary.slug, category: "Payments", madeFor: "bankworkx", journey: manageBeneficiary,
    summary: "Save a person or company to pay, change their details, or remove them. The bank checks the details and the name; a new or changed payee is limited to 500.00 USD for 24 hours.",
    highlights: ["Add a BankWorkx customer, a payee at a US, European, UK or Middle East bank, or abroad", "Name check with Use for a close match", "One-time code to add or change the name or account", "Nickname and label changes need no code", "Delete with or without the scheduled payments that use the payee", "Timeout and unavailable screens"],
  },
  {
    id: personalTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: personalTransfer,
    summary: "Send money to a BankWorkx customer, a person at another bank or another country: choose how fast, see the fee, the rate and the arrival, confirm with a one-time code. A payee typed in the payment can be saved; a new payee is limited to 500.00 USD for 24 hours.",
    highlights: ["Three ways to send, each switched on or off by the bank", "Find a BankWorkx customer by mobile, email or ID", "Standard, Same day, Instant (and Priority) with fee, arrival and limit", "Rate held 60 seconds, then a new price", "Later and repeating payments on business days", "Held for review, timeout and unavailable screens"],
  },
  {
    id: payBillBankworkx.slug, category: "Payments", madeFor: "bankworkx", journey: payBillBankworkx,
    summary: "Pay a bill from the bank's directory of billers: enter the reference, see the bill, pay the full amount, the minimum or another amount, confirm with a one-time code, and get a receipt.",
    highlights: ["Directory with search, categories and saved billers", "Reference format per biller", "Full, minimum or other amount", "Late fee, fee and rate in another currency", "Save the biller or pay automatically", "Timeout and unavailable screens"],
  },
  {
    id: mobileTopup.slug, category: "Payments", madeFor: "bankworkx", journey: mobileTopup,
    summary: "Add credit to a mobile number: choose the operator, the number (a saved one or another), one of the operator's fixed amounts and the account to pay from, confirm with a one-time code, and get a receipt.",
    highlights: ["Operators with fixed amounts", "Number rule of the home market", "Saved numbers, saved from the review", "Up to 300.00 a day to one number", "Timeout and unavailable screens"],
  },
  {
    id: schedulePayment.slug, category: "Payments", madeFor: "bankworkx", journey: schedulePayment,
    summary: "Pay a payee, one of your own accounts or a saved bill on a future date or on a repeat (once, weekly, every 2 weeks, monthly, every 3 months), with an end and a reminder; change a schedule later. Nothing is taken until each date.",
    highlights: ["Payee, own account or saved bill", "Weekdays, month ends and closed days handled", "Ends never, on a date or after a number of payments", "Changes close the business day before", "20 schedules at most", "Timeout and unavailable screens"],
  },
  {
    id: cancelStandingOrder.slug, category: "Payments", madeFor: "bankworkx", journey: cancelStandingOrder,
    summary: "End a scheduled or recurring payment for good, or skip only the next one, from the list of what is scheduled. No code is asked, because it can only reduce what leaves the account. The cancel mode of Schedule a payment, as a journey of its own.",
    highlights: ["All future payments or only the next one", "Refused while running or after changes close", "No code needed", "Timeout and unavailable screens"],
  },
  {
    id: supplierPayment.slug, category: "Payments", madeFor: "bankworkx", journey: supplierPayment,
    summary: "A Maker pays a saved supplier from the company's account: amount, reference and purpose, the speeds the bank offers, a review, and a code from the company's threshold. The payment then waits for approvers; nothing leaves the account until it is released.",
    highlights: ["Only saved suppliers", "Speeds with fee and arrival; one over its limit is marked", "Rate and fee for a supplier paid in another currency", "One or two approvers shown on the review", "Code only from the threshold, naming the amount and the supplier", "Refused by the bank for a role without the permission"],
  },
  {
    id: businessAccounts.slug, category: "Accounts", madeFor: "bankworkx", journey: businessAccounts,
    summary: "The company's accounts in one place: the total balance, each account's available and ledger balance, the numbers to receive money on, and a searchable list of transactions by period. Some accounts are view only. Nothing here moves money.",
    highlights: ["Total in the company's currency", "Available balance net of pending and waiting payments", "Numbers to receive money follow the bank's home market", "7, 30, 90 days or this month, and a search", "View only accounts show no transactions", "Export and Pay from this account only with the right"],
  },
  {
    id: businessStatement.slug, category: "Accounts", madeFor: "bankworkx", journey: businessStatement,
    summary: "Send a statement or a report for one or several accounts by email, once or on a schedule, as PDF, CSV or Excel (and the bank formats when the bank offers them). Only accounts the person may export; addresses at the company unless the bank allows others. Nothing is charged and no money moves.",
    highlights: ["Only accounts the person may export", "Last month, last 3 months or a custom period up to 24 months", "Bank formats and Today so far only when the bank turns them on", "Up to 5 addresses, at the company by default", "Schedules: daily, weekly or monthly, ten at most", "Timeout and unavailable screens send nothing"],
  },
  {
    id: addSupplier.slug, category: "Payments", madeFor: "bankworkx", journey: addSupplier,
    summary: "A Maker asks for a supplier to be added to the company's approved list: the name, the bank details for the bank's home market (or another country, with an address), the bank's name check, a review and always a one-time code. An administrator approves it before the supplier can be paid.",
    highlights: ["Bank details follow the bank's home market", "Another country: IBAN or account, bank code, SWIFT/BIC, address", "Name check: Use, Switch, or Add anyway", "Name, bank details and ten waiting are refused", "Code always asked, naming the supplier", "Waits for an administrator; cannot be paid yet"],
  },
  {
    id: paymentTemplate.slug, category: "Payments", madeFor: "bankworkx", journey: paymentTemplate,
    summary: "A Maker saves a payment made often (a supplier, an amount or none, a reference and a purpose), starts it again from the list, or deletes a template. A template holds no money and needs no approval; the payment it starts asks for its own.",
    highlights: ["Create, use and delete in one journey", "Amount optional: Amount each time", "Twenty templates at most; a name only once", "Use fills in Pay a supplier", "A supplier waiting for approval or gone cannot be used", "Starts from a payment already made"],
  },
  {
    id: templates.slug, category: "Payments", madeFor: "bankworkx", journey: templates,
    summary: "The company's saved payments with their supplier and amount (or Amount each time), Use to start Pay a supplier with one, Delete, and Save a template. A template whose supplier is waiting for approval or gone cannot be used. An Approver sees the list without buttons.",
    highlights: ["Supplier and amount, or Amount each time", "Use fills in Pay a supplier", "Waiting for approval and Unavailable chips instead of Use", "Buttons only with the right to manage templates or pay", "Empty state and retry state"],
  },
  {
    id: scheduleBusinessPayment.slug, category: "Payments", madeFor: "bankworkx", journey: scheduleBusinessPayment,
    summary: "A Maker schedules a payment to a saved supplier once, weekly, monthly or every 3 months, with an end; approvers approve it once before the first payment and the bank checks again before each one. The same journey changes a schedule (it goes back for approval) or cancels it at once. A code is asked only from the company's threshold.",
    highlights: ["Saved, approved suppliers only", "Working days from tomorrow to 12 months ahead", "Ends never, on a date or after a number of payments", "Next three dates and approvers on the review", "Changes close the business day before", "Twenty schedules at most; timeout and unavailable screens"],
  },
  {
    id: businessSchedules.slug, category: "Payments", madeFor: "bankworkx", journey: businessSchedules,
    summary: "Scheduled and repeating supplier payments: supplier, reference, amount, how often, next date, whether the schedule waits for approval (0 of 1 approved) or is active, and a warning when the bank would skip the next payment and why. Change and Cancel open the schedule journey.",
    highlights: ["Active and Waiting for approval badges", "Next date moved off weekends and closed days", "Warns when the next payment would be skipped, and why", "Change, Cancel and Schedule a payment only with the right", "Cancelled schedules are not listed"],
  },
  {
    id: businessWithdraw.slug, category: "Payments", madeFor: "bankworkx", journey: businessWithdraw,
    summary: "A Maker takes back a payment they started while it still waits for approval: pick it (or open it from the tracker), an optional reason (Other adds a note), and the payment becomes Withdrawn. Nothing was sent and no code is asked; the bank refuses another person's payment and one already released.",
    highlights: ["Only your own pending payments", "Optional reason; Other adds a note of up to 100 characters", "Released or no longer pending payments are refused", "The amount is given back to the daily limit", "Check Payments message on a timeout; unavailable sheet", "Refused by the bank for a role without the permission"],
  },
  {
    id: paymentTracker.slug, category: "Payments", madeFor: "bankworkx", journey: paymentTracker,
    summary: "Every payment the company started, newest first, with its status (Pending approval, Released to bank, Settled, Rejected, Withdrawn) and a status timeline: who started it, who approved, the cut-off and, for a withdrawn payment, the reason. Withdraw opens for the Maker's own pending payment. Nothing here moves money.",
    highlights: ["Filter by status one at a time", "Timeline matches the status and names the approvers", "Withdraw only on your own pending payment", "An Approver sees the list and a note about their role", "Empty and Nothing here states; retry state"],
  },
  {
    id: approvePayments.slug, category: "Payments", madeFor: "bankworkx", journey: approvePayments,
    summary: "An Approver's inbox: the payments colleagues started, who has approved and whose turn it is, the bank's name check of the payee and the cut-off. Approve (with a tick and a code from the threshold), reject with a reason, pass to another approver, or approve several with one code; the last approval releases the payment.",
    highlights: ["Inbox and history with search and status filter", "Four eyes, order of approvers, cut-off", "Name check chip and the bank's record", "One code for several payments, all or none", "Reject needs a reason", "No-access card for a Maker, refused again by the bank"],
  },
  {
    id: internalTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: internalTransfer,
    summary: "Send money to a BankWorkx customer: found by mobile number, email or BankWorkx ID, free and instant, up to 25,000.00. The same flow as Send money, opened at this type; kept so that links to the old name open the right place.",
    highlights: ["Alias of Send money for one type", "Free and instant", "Switched off with the same option", "One-time code"],
  },
  {
    id: internationalTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: internationalTransfer,
    summary: "Send money abroad: country, name, IBAN or account, SWIFT/BIC, purpose; the rate held 60 seconds. Send money opened at this type, so old links open the right place.",
    highlights: ["Alias of Send money for one type", "Standard and Priority speeds", "Switched off with the same option", "One-time code"],
  },
  {
    id: connectAccount.slug, category: "More", madeFor: "bankworkx", journey: connectAccount,
    summary: "See accounts held at another bank, read only: choose the bank, agree to share, allow it on the other bank's own sign-in (no password is typed here), choose the accounts. Sharing ends after the period of the bank's home market; a connected bank can be disconnected.",
    highlights: ["Read only, never a source of payment", "Agreement before anything is shared", "Allow or Deny on the other bank's own sign-in", "Credit card only when allowed", "Sharing period and currency follow the market", "Disconnect with a confirmation", "Timeout and unavailable screens"],
  },
  {
    id: addCard.slug, category: "Cards", madeFor: "bankworkx", journey: addCard,
    summary: "Save a card from another bank to add money or pay: the bank checks the details, a text message code or a small test charge proves the person holds it, then a nickname, what it is used for and a tick. Up to 5 cards.",
    highlights: ["Number, type, expiry, security code and postcode checked", "A code before the card is saved", "Three wrong codes end it", "Same card never twice", "Only the last four digits are kept"],
  },
  {
    id: createBudget.slug, category: "Budgeting", madeFor: "bankworkx", journey: createBudget,
    summary: "Set a monthly amount for a spending category and get alerts at 80% and 100%; change or delete it later. No code: no money moves.",
    highlights: ["Categories that have a budget are marked", "10.00 to 100,000.00 a month", "Alerts at 80% and 100%", "Edit and delete in one journey", "Spent in the last 30 days"],
  },
  {
    id: accounts.slug, category: "Accounts", madeFor: "bankworkx", journey: accounts,
    summary: "Every account in one place: the total in the home currency and a row for each account with its available balance, grouped Everyday, Savings, Other currencies and Hidden.",
    highlights: ["Total of the ledger balances in dollars", "Available balance on every row", "Frozen, Dormant and Closing chips", "Hide the amounts", "Opens the account"],
  },
  {
    id: accountDetails.slug, category: "Accounts", madeFor: "bankworkx", journey: accountDetails,
    summary: "One account: available and ledger balance and what is on hold, the numbers of the home market, rename, hide, close with a one-time code, and its transactions with search and a report-a-problem.",
    highlights: ["Available, ledger and on hold", "Search, In and Out, Show more", "Report a problem once per payment", "Close with a reason, a destination and a code", "Dormant and Closing warnings"],
  },
  {
    id: statement.slug, category: "Accounts", madeFor: "bankworkx", journey: statement,
    summary: "A statement for an account and a period as PDF or CSV, downloaded or emailed; the bank can add an official statement, a proof of address letter and a balance certificate with a fee and a one-time code.",
    highlights: ["This month, last month, 3 months or dates", "Refusals before any fee: empty period, dates, dormant account, funds", "Fee taken only after the code", "Paperless remembered per account", "Timeout and unavailable screens"],
  },
  {
    id: accountNickname.slug, category: "Accounts", madeFor: "bankworkx", journey: accountNickname,
    summary: "Rename an account: an alias that opens Account details at its Rename step.",
    highlights: ["Alias of Account details", "2 to 24 characters, no duplicate names", "Use the original name"],
  },
  {
    id: openAnotherAccount.slug, category: "Accounts", madeFor: "bankworkx", journey: openAnotherAccount,
    summary: "Open a current, savings or currency account in a few steps: choose, name it, review the key facts and the terms, confirm with a one-time code. At most six accounts.",
    highlights: ["Savings and currency accounts switched on by the bank", "Name checked before the code", "Key facts of the product", "One-time code, three wrong codes stop it", "Account limit"],
  },
  {
    id: budgets.slug, category: "Budgeting", madeFor: "bankworkx", journey: budgets,
    summary: "Every monthly budget with what was spent in the last 30 days, how much of it is used and a chip: On track, Close to limit or Over budget; Edit, Delete and New budget open Create a budget.",
    highlights: ["Chips at 80% and 100%", "Never more than 100% shown", "Empty state", "Opens Create a budget"],
  },
  {
    id: transferTypes.slug, category: "Payments", madeFor: "bankworkx", journey: transferTypes,
    summary: "The ways to send money the bank has on, how fast each is, and the speeds to another bank and another country with arrival, fee and limit; each opens the journey that sends that way.",
    highlights: ["Rows follow the bank's options", "Speeds and fees from the bank's home market", "No scheme or country named", "Moves no money"],
  },
  {
    id: singleTransfer.slug, category: "Payments", madeFor: "bankworkx", journey: singleTransfer,
    summary: "Quick transfer: pay a saved payee at another bank or in another country. An alias that opens Send money with the type chosen, with the bank's Instant, Later and new-payee options passed on.",
    highlights: ["Alias of Send money", "Instant, Later and new-payee options reach Send money", "Nothing to send with when both ways are off"],
  },
  {
    id: cardPin.slug, category: "Cards", madeFor: "bankworkx", journey: cardPin,
    summary: "Set or change the PIN of a card after a one-time code: choose the card, the code, a new 4-digit PIN typed twice. The PIN is never shown or kept; easy PINs are refused.",
    highlights: ["One-time code first", "PIN typed twice, never shown", "Easy PINs refused (blockWeak)", "Three wrong codes end it", "Virtual and inactive cards refused"],
  },
  {
    id: cardsView.slug, category: "Cards", madeFor: "bankworkx", journey: cardsView,
    summary: "The person's cards (debit, credit and virtual) as faces with their status, the money available, quick actions for the chosen card (Freeze, Controls, PIN, Activate, Replace) and its recent transactions.",
    highlights: ["Card faces with status pills", "One status line per card state", "Quick actions follow the card's state", "Freeze at once; unfreeze asks for a code", "Recent transactions", "No cards and unavailable states"],
  },
  {
    id: activateCard.slug, category: "Cards", madeFor: "bankworkx", journey: activateCard,
    summary: "Turn on a new card with its last 4 digits, expiry and security code, then set its PIN now or later. Three wrong tries lock activation.",
    highlights: ["Last 4 digits, expiry and security code", "Three wrong tries lock the card", "PIN rules at activation", "Set the PIN now or later", "Bank-side checks and no code kept"],
  },
  {
    id: cardControls.slug, category: "Cards", madeFor: "bankworkx", journey: cardControls,
    summary: "Freeze or unfreeze a card, set its spending limits, choose where it works (with an optional trip) and set alerts. Tightening is instant; loosening asks for a one-time code.",
    highlights: ["Freeze at once, unfreeze with a code", "Limits against the bank's ceilings and their order", "Where it works with a trip up to 90 days", "Alerts never ask for a code", "Review lists each change before and after"],
  },
  {
    id: freezeCard.slug, category: "Cards", madeFor: "bankworkx", journey: freezeCard,
    summary: "An alias of Card limits and controls: opens it on the freeze change (or the unfreeze change, which asks for a code).",
    highlights: ["Alias of Card limits and controls", "Freeze needs no code", "Unfreeze asks for a one-time code"],
  },
  {
    id: virtualCard.slug, category: "Cards", madeFor: "bankworkx", journey: virtualCard,
    summary: "Create a virtual card for online shopping, subscriptions or one payment, with its own limit. Confirmed with a one-time code; the details are shown once.",
    highlights: ["Linked to an active card", "Limit from 1.00 to 5,000.00", "Single use or 3 years", "At most 5 per card", "Details shown once"],
  },
  {
    id: replaceCard.slug, category: "Cards", madeFor: "bankworkx", journey: replaceCard,
    summary: "Order a replacement for a lost, stolen, damaged or expired card. A lost or stolen card is blocked at once; the order needs a one-time code.",
    highlights: ["Lost and stolen block the card at once", "Damaged keeps working until the new card is used", "Express delivery has a fee", "Home or another address", "One-time code before the order"],
  },
  {
    id: disputeTransaction.slug, category: "Cards", madeFor: "bankworkx", journey: disputeTransaction,
    summary: "Report a card payment the person does not recognise or that went wrong: only a posted payment out, at most 120 days old, once. Moves no money; the bank decides after review.",
    highlights: ["Posted card payments out, within 120 days", "Details by reason", "Optional receipt or screenshot", "Declaration", "Block the card when not recognised"],
  },
  {
    id: invest.slug, category: "Investing", madeFor: "bankworkx", journey: invest,
    summary: "Invest in one of four funds: filter by risk, see the charge and the smallest amount, confirm the risk of a high-risk fund, review, and pay with a one-time code. A stock opened from the Invest tab is still bought the older way.",
    highlights: ["Four funds with risk, charge and smallest amount", "Risk filter, high-risk funds can be switched off", "Risk acknowledgement", "Estimated units and charge", "One-time code", "Timeout and unavailable screens"],
  },
  {
    id: sellInvestment.slug, category: "Investing", madeFor: "bankworkx", journey: sellInvestment,
    summary: "Sell part or all of a fund holding: see the selling fee, the estimated proceeds and when the money arrives, confirm with a one-time code. Selling everything removes the holding.",
    highlights: ["Only funds you hold", "An amount or everything", "0.25% selling fee when on", "Settlement two business days later", "One-time code", "Timeout and unavailable screens"],
  },
  {
    id: saveBorrow.slug, category: "Save & Borrow", madeFor: "bankworkx", journey: saveBorrow,
    summary: "Savings goals, term deposits, loans and the investment portfolio on one screen, each card with its key number and the next action. A section shows only when the bank has it on and its journey is allowed.",
    highlights: ["Four sections in a fixed order", "Goal progress, deposit maturity, loan balance, portfolio gain", "Empty text and one button when a section has nothing", "Nothing to show when every section is off"],
  },
  {
    id: termDeposit.slug, category: "Save & Borrow", madeFor: "bankworkx", journey: termDeposit,
    summary: "Open a term deposit for 3, 6, 12 or 24 months, renew it or change what happens at maturity, or close it early with the charge shown first. One-time code every time.",
    highlights: ["Rate and maturity by term", "Interest at maturity or every month", "Early closure keeps half the interest earned", "The money paid in is never touched", "Timeout and unavailable screens"],
  },
  {
    id: savingsGoal.slug, category: "Save & Borrow", madeFor: "bankworkx", journey: savingsGoal,
    summary: "Create or change a savings goal with a target and a month, an automatic monthly top-up, add money to it or take it out. The money stays the customer's, so no code is asked.",
    highlights: ["Monthly amount needed to reach the target", "Automatic top-up on the 1st", "Up to 10 goals", "Add and take out", "Timeout and unavailable screens"],
  },
  {
    id: applyLoan.slug, category: "Save & Borrow", madeFor: "bankworkx", journey: applyLoan,
    summary: "Choose an amount and a term, see the monthly payment, tell the bank about work and income, get a decision at once and accept the offer with the terms ticked and a one-time code.",
    highlights: ["Monthly payment as the amount changes", "Approved, in review or declined", "Rate one point higher above 35% of income", "Arrangement fee when on", "At most 3 loans", "Timeout and unavailable screens"],
  },
  {
    id: repayLoan.slug, category: "Save & Borrow", madeFor: "bankworkx", journey: repayLoan,
    summary: "Pay the next instalment, another amount, or settle a loan in full with the settlement figure shown first; confirm with a one-time code.",
    highlights: ["Next instalment lowers the balance by its principal", "Another amount from 10.00", "Settlement with interest to date and the early fee", "One-time code", "Timeout and unavailable screens"],
  },
  {
    id: updateProfile.slug, category: "More", madeFor: "bankworkx", journey: updateProfile,
    summary: "Change the mobile number, the email or the address held by the bank. Every change needs a one-time code sent to the number on file; a new number gets a code too; an email and an address can wait for the bank's check. The old contact is told.",
    highlights: ["One-time code to the number on file", "Second code to a new mobile number", "Email and address can show as Pending", "Rules of the home market for number and postal code", "Proof of address when the bank asks", "Old and new contact told, values shown masked"],
  },
  {
    id: newMessage.slug, category: "More", madeFor: "bankworkx", journey: newMessage,
    summary: "Send a secure message to the bank with a topic, a subject, the text and one optional file (PDF, JPG or PNG up to 5 MB). No money moves and no code is asked; the reply arrives in Messages.",
    highlights: ["Topic, subject and message checked", "Warning to call for fraud or security", "One optional file up to 5 MB", "Text shown as text, never as markup", "The text is kept when the bank does not answer"],
  },
  {
    id: messagesView.slug, category: "More", madeFor: "bankworkx", journey: messagesView,
    summary: "The secure conversations with the bank: the latest activity first, an unread mark, a thread with every message in order, a reply box for an open conversation and a new message for a closed one.",
    highlights: ["Preview, date and unread mark", "Opening a conversation marks it read", "Reply of at least 2 characters", "Closed conversations offer a new message", "Empty state with New message"],
  },
  {
    id: serviceRequest.slug, category: "More", madeFor: "bankworkx", journey: serviceRequest,
    summary: "Ask the bank for something and get a reference: order a cheque book, request a letter, change an account type or send another request. A lost card goes to the card controls instead.",
    highlights: ["Only the kinds the bank offers", "Branch asked only when collecting", "Account types without the current one", "One open cheque book request per account", "Reference and status Received"],
  },
  {
    id: myRequests.slug, category: "More", madeFor: "bankworkx", journey: myRequests,
    summary: "The service requests the customer has sent, newest first, each with its status (Received, In progress, Done, Cancelled); a request opens to what was asked, and one that is only Received can be cancelled after a confirmation.",
    highlights: ["Title, date, reference and status", "Detail with the rows as sent", "Cancel only while Received", "Keep it changes nothing", "Empty state with New request"],
  },
  {
    id: signIn.slug, category: "Access", madeFor: "bankworkx", journey: signIn,
    summary: "Sign in with a username and password; a one-time code on a new or unusual device; a new password when the old one expired; trust the device; quick sign-in with a PIN, passkey or Face ID. Locks after 5 wrong tries.",
    highlights: ["Attempts left, then locked, with a way to unlock", "Code on a new device, never on a trusted one", "New password with five rules", "Trust this device for 90 days", "Quick PIN, passkey or Face ID", "Timeout and unavailable screens"],
  },
  {
    id: forgotUsername.slug, category: "Access", madeFor: "bankworkx", journey: forgotUsername,
    summary: "Get the username by message: a mobile number or email with a date of birth, then a one-time code. The username is sent to the contact on file and never shown.",
    highlights: ["Mobile or email with date of birth", "A miss never says which part failed", "Locks after 3 tries", "The username is never shown", "Timeout and unavailable screens"],
  },
  {
    id: resetPassword.slug, category: "Access", madeFor: "bankworkx", journey: resetPassword,
    summary: "Get back into a profile by username or email and a one-time code, then choose a new password, or only unlock the profile and keep the old password.",
    highlights: ["Reset or unlock in one journey", "Code to the mobile on file, masked", "Five password rules", "Lock cleared by a reset", "Token that runs out", "Timeout and unavailable screens"],
  },
  {
    id: forgotPassword.slug, category: "Access", madeFor: "bankworkx", journey: forgotPassword,
    summary: "The name behind the Forgot password? link: Reset password opened in its reset mode, so a bank can place the link under its own name.",
    highlights: ["Alias of Reset password", "Passes the username on"],
  },
  {
    id: unlockAccount.slug, category: "Access", madeFor: "bankworkx", journey: unlockAccount,
    summary: "Unlock a locked profile with a one-time code and keep the password: Reset password opened in its unlock mode. With unlocking switched off it offers the reset.",
    highlights: ["Alias of Reset password", "Password unchanged", "Says when the profile was not locked"],
  },
  {
    id: changePassword.slug, category: "Access", madeFor: "bankworkx", journey: changePassword,
    summary: "Change the password: the current one, a new one checked against the rules, then a one-time code. Five wrong current passwords lock the profile.",
    highlights: ["Attempts left, then locked, with a reset", "Rules with their own messages", "One-time code, three tries", "Other devices signed out", "Step-up first"],
  },
  {
    id: trustedDevices.slug, category: "Access", madeFor: "bankworkx", journey: trustedDevices,
    summary: "See the devices that skip the new-device code, remove one or sign out all the others after a one-time code. The device in hand is never removed.",
    highlights: ["Last use of each device, n of 5", "Code before any removal, three tries", "Locks the view after three wrong codes", "Step-up first"],
  },
  {
    id: setupQuickLogin.slug, category: "Access", madeFor: "bankworkx", journey: setupQuickLogin,
    summary: "Choose how this device signs you in without the password: Face ID or fingerprint, a passkey or a 6-digit PIN, confirmed on the device and with a one-time code; or turn it off.",
    highlights: ["Methods the bank offers and the device can do", "PIN rules checked before the code", "Code, three tries", "Turning off needs no code", "Step-up first"],
  },
  {
    id: changeQuickPin.slug, category: "Access", madeFor: "bankworkx", journey: changeQuickPin,
    summary: "Change the 6-digit PIN used for quick sign-in on this device: the current PIN, then a new one with no repeats or runs. Three wrong PINs turn quick sign-in off.",
    highlights: ["Current PIN is the proof, no code", "Tries left, then quick sign-in off", "PIN rules with their own messages", "Step-up first"],
  },
  {
    id: loanCalculator.slug, category: "Public", madeFor: "bankworkx", journey: loanCalculator,
    summary: "Before signing in: choose a personal, car or home loan, set the amount and the term and read the monthly payment, the total interest and the total to repay. An estimate only; nothing is applied for.",
    highlights: ["The bank's table: ranges, steps and rates", "Figures in whole cents, no float", "The box follows the amount and the term", "Start application carries the amount and the term", "Symbol of the bank's home market", "Works with no sign-in and keeps nothing"],
  },
  {
    id: depositCalculator.slug, category: "Public", madeFor: "bankworkx", journey: depositCalculator,
    summary: "Before signing in: choose an amount, a term (3, 6, 12, 24 or 60 months) and when interest is paid, and read the interest and what comes back. An estimate only; nothing is opened.",
    highlights: ["Simple interest in whole cents", "Interest at the end or every month", "Rates by term from the bank's table", "Start application carries the amount and the term", "Works with no sign-in and keeps nothing"],
  },
  {
    id: findBranchAtm.slug, category: "Public", madeFor: "bankworkx", journey: findBranchAtm,
    summary: "Before signing in: find branches and cash machines by area or street, by kind and by open now, on a simple map and in a list nearest first, with hours, services and a hand-over to the maps app.",
    highlights: ["Open or closed from the hours and the clock", "Miles or kilometres by market", "Seven opening-hours rows and the services", "Cash machines and Open now are bank options", "No location asked for, nothing kept"],
  },
  {
    id: contactSupport.slug, category: "Public", madeFor: "bankworkx", journey: contactSupport,
    summary: "Before signing in: reach the bank by chat, by phone or by a written message, each with its own opening hours; a signed-in customer can use secure messages.",
    highlights: ["Chat, Call and Message with open or closed chips", "Chat and Call are bank options", "A topic, an email and a message checked by the bank", "Five messages an hour from one device", "The bank keeps a count and a masked address, never the words"],
  },
  {
    id: openAccount.slug, category: "Onboarding", madeFor: "bankworkx", journey: openAccount,
    summary: "New-customer onboarding: verify a mobile with a one-time code, give details and an address, show an ID and a selfie, describe work and money, make the tax declaration, choose an account, read and sign the terms. Creates an application; the bank decides. Save and finish later keeps the answers for 30 days.",
    highlights: ["ID format, proof of address, postcode and tax wording by market", "Simulated ID and selfie capture, nothing kept", "Save and resume without the photos, the code, the ID number or the tax ID", "Terms read to the end and signed with the name given", "Income over 1M goes to manual review", "Declined and unavailable paths"],
  },
  {
    id: trackApplication.slug, category: "Public", madeFor: "bankworkx", journey: trackApplication,
    summary: "Before signing in: find an application with its number and the last digits of the mobile, confirm a one-time code and see where it is (Received, Checking your ID, Ready); a Ready application goes on to Register for digital banking.",
    highlights: ["Code before any status, at the bank too", "One miss never says which part was wrong", "Three wrong tries lock it for 30 minutes", "Ready shows the account number", "Hands over to registration"],
  },
  {
    id: registerDigitalBanking.slug, category: "Onboarding", madeFor: "bankworkx", journey: registerDigitalBanking,
    summary: "An existing customer who never used digital banking proves who they are with a customer ID or a card number and a date of birth (or a Ready application), confirms a one-time code and chooses a username and password; may trust the device.",
    highlights: ["Same one-time code and password rules as sign-in", "Password kept only as a hash and cleared from the journey", "Three wrong checks or codes lock it for 30 minutes", "Username taken, format and strength checked by the bank", "Trust this device is a bank option"],
  },
  // Cairo Amman Bank: the access journeys from its design file
  ...(
    [
      ["sign-in", "Sign in with username and password, with attempts left, a locked profile, an expired password and a profile not yet activated.", ["Attempts left, then locked", "Locked, expired and inactive screens", "English and Arabic"]],
      ["default-sign-in", "Choose how to sign in by default: password, biometric, or a six-digit PIN entered twice.", ["PIN entered twice", "Biometric option", "Mismatch check"]],
      ["account-preview", "Turn on balances before sign-in, and see what the sign-in screen will show.", ["Toggle", "Balances picture", "Privacy notice"]],
      ["change-language", "Change the app language, with a confirmation step.", ["Language list", "Confirm before changing"]],
      ["enroll", "Enrol a retail customer from last name, national ID and date of birth, with a picture code.", ["Picture code", "Records check", "Already enrolled and not found paths"]],
      ["activate-profile", "Activate a profile with the username and activation code, then create a password under the bank's rules.", ["Activation code blocks after 3 mistakes", "Password rules", "Passwords must match"]],
      ["cant-sign-in", "Find a customer who cannot sign in, verify with a one-time code and set a new password, or send a new activation code.", ["Picture code", "One-time code with lock after 3 mistakes", "Reset or reactivate"]],
      ["locate-us", "Find branches and ATMs by kind, range and text, and see hours and distance.", ["Filters", "Results list", "Call from the details"]],
      ["support", "FAQs by topic, terms, privacy and calling the bank.", ["FAQ topics", "Terms and privacy", "Call us"]],
    ] as const
  ).map(([slug, summary, highlights]) => ({ id: slug, category: "Access" as const, madeFor: "cab" as const, journey: cabJourneys.find((j) => j.slug === slug)!, summary, highlights: [...highlights] })),
];


export const catalogEntry = (id: string) => catalog.find((c) => c.id === id);
