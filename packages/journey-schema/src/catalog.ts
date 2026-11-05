import type { Journey } from "./schema";
import { localTransfer } from "./fixtures/local-transfer";
import { payBill } from "./fixtures/pay-bill";
import { payBillBankworkx } from "./fixtures/pay-bill-bankworkx";
import { mobileTopup } from "./fixtures/mobile-topup";
import { schedulePayment } from "./fixtures/schedule-payment";
import { cancelStandingOrder } from "./fixtures/cancel-standing-order";
import { supplierPayment } from "./fixtures/supplier-payment";
import { approvePayments } from "./fixtures/approve-payments";
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
import { addMoney, addCard, connectAccount, createBudget, invest, sellInvestment } from "./fixtures/bankworkx";
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

/**
 * The journey catalog: ready-made journeys a project can add to its own app.
 * Each entry is the journey exactly as shipped, so adding it never depends on what someone later edited in Studio.
 */
export const CATEGORIES = ["Payments", "Accounts", "Cards", "Budgeting", "Investing", "Access"] as const;
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
    summary: "Top up an account from a saved card, with quick amounts and a review step.",
    highlights: ["Quick amount chips", "Card picker", "Review and receipt"],
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
    id: connectAccount.slug, category: "Accounts", madeFor: "bankworkx", journey: connectAccount,
    summary: "Link an account from another bank: pick the bank, sign in, choose accounts.",
    highlights: ["Bank tiles", "Hidden password field", "Failure path for a bad sign-in"],
  },
  {
    id: addCard.slug, category: "Cards", madeFor: "bankworkx", journey: addCard,
    summary: "Add a debit or credit card with a live card number check and clear field errors.",
    highlights: ["Card number and expiry checks", "Per-field errors", "Review before saving"],
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
    summary: "Buy a stock or fund with a dollar amount, even part of a share, with a review step before the order.",
    highlights: ["Instrument picker", "Quick amount chips", "Risk notice", "Failure path with no money moved"],
  },
  {
    id: sellInvestment.slug, category: "Investing", madeFor: "bankworkx", journey: sellInvestment,
    summary: "Sell part or all of a holding and have the money paid into an account.",
    highlights: ["Holding picker", "Amount capped by what you own", "Failure path with nothing sold"],
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
