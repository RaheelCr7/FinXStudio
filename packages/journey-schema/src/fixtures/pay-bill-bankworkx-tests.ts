import type { Journey } from "../schema";

/** What must be true for "Pay a bill" to be right. Each is proved by at least one scenario below. */
export const payBillBankworkxAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The directory lists billers by category, filters by search and category, shows saved billers first, and shows \"No billers found\" when nothing matches." },
  { id: "AC-2", text: "The reference is checked against the biller's format; a wrong format shows the biller's message; spaces and hyphens are ignored." },
  { id: "AC-3", text: "The lookup shows the amount due, the due date and an \"Overdue\" chip when late, and shows the right card for not found, paid, nothing due and biller unavailable; the person cannot go on in those states." },
  { id: "AC-4", text: "Full amount is always offered; minimum only for cards and loans; other amount only where the biller accepts it, with the limits \"From {min} to {max}\" or \"Up to {max}\"; an amount outside them is refused with the message; the minimum and other amount are not offered when allowPartial is off." },
  { id: "AC-5", text: "Paying from an account in another currency shows the rate and \"You pay\" in that currency, only when allowCrossCurrency is on; the fee of the biller is shown separately." },
  { id: "AC-6", text: "Not enough money, an amount over the daily limit, or an account that cannot pay is refused before the review with the messages, and nothing is paid." },
  { id: "AC-7", text: "If the amount due changes between the lookup and the review, the review shows \"The amount due changed. Check it and confirm again.\" once, with the new amount." },
  { id: "AC-8", text: "A one-time code that names the amount and biller confirms the payment; the confirmation must be ticked and the code must be six digits; three wrong codes stop the journey and nothing is paid." },
  { id: "AC-9", text: "After a partial payment the next lookup shows what is left; after payment in full it shows \"Already paid\"." },
  { id: "AC-10", text: "\"Save this biller\" and \"Pay automatically\" appear only when their options are on, \"Pay automatically\" only for the listed categories, and each does what the receipt says." },
  { id: "AC-11", text: "With billFetch off the person types the amount and no lookup is made." },
  { id: "AC-12", text: "On timeout nothing is paid and the person is told to check Activity first; when the bank is unavailable, or a slow or unavailable service is met on the way, nothing is paid." },
];

// The sandbox customer "alexbills" has Main $8,720.76, Savings $15,254.37, EUR Travel €2,400.00 and AED Home AED 11,000.00, a daily limit of $50,000.00
// and two saved billers: Home electricity (City Power 4400123456) and Home internet (Skyline Broadband 5550012345). Today is Tuesday 3 November 2026.
const PERSONA = "alexbills";
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
/** Reads one balance from the bank. */
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000)];
const used = (equals: number): Step => ({ expectBank: { adapter: "bank.limits.get", path: "usedToday", equals } });

// The references (the last four digits choose the outcome) and what the sandbox bank says of them on Tuesday 3 November 2026.
const POWER = "4400123456"; // City Power, saved as "Home electricity": $322.80, due Sun 22 Nov
const POWER2 = "4400123457"; // City Power, not saved: $322.85, due Mon 23 Nov
const CARD = "1234567890123456"; // Northwind Card: $372.80, minimum $37.28, the most $671.04
const INSURANCE = "HI12345678"; // Harbor Insurance: $383.90, full amount only
const COUNTY = "123456781234"; // County Revenue: $111.70, full amount only, not offered Pay automatically
const CLEARWAVE = "5550987654"; // ClearWave Telecom: $232.70, fee $1.00

/** From the directory: choose the biller and give the reference; ends on the amount screen. */
const bill = (biller: string, ref: string): Step[] => [press(biller), set({ "pb.ref": ref }), press("Continue")];
/** Tick the confirmation and ask for the code. */
const confirm: Step[] = [set({ "pb.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
/** The whole payment, from the review to the receipt. */
const pay = (): Step[] => [...confirm, ...code(), press("Pay bill"), screen("success")];

const base = { persona: PERSONA, now: NOW };
/** Main drained to $20.76 before the walk, to reach "Not enough in this account." */
const drain: NonNullable<Journey["scenarios"]>[number]["setup"] = [
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.transfers.own", input: { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8700 } },
];

export const payBillBankworkxScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The directory: saved billers first, then all; search \"water\" finds Metro Water; \"zzz\" finds nothing; a search over 40 characters is refused", covers: ["AC-1"], ...base,
    steps: [
      screen("biller"), text("Saved"), text("Home electricity"), text("City Power ••3456"), text("Home internet"), text("All billers"), text("Metro Water"), text("Harbor Insurance"),
      set({ "pb.search": "water" }), press("Search"), text("Metro Water"), noText("City Power"), noText("Home electricity"), noText("No billers found"),
      set({ "pb.search": "zzz" }), press("Search"), text("No billers found"), text("Try another name or category."), noText("Saved"), noText("All billers"),
      set({ "pb.search": "x".repeat(41) }), press("Search"), error("Use up to 40 characters."),
    ],
  },
  {
    id: "T-2", name: "The category chips filter the directory and the saved billers; a category and a search work together", covers: ["AC-1"], ...base,
    steps: [
      set({ "pb.filter": "Insurance" }), press("Search"), text("Harbor Insurance"), text("Pioneer Life"), noText("City Power"), noText("Home electricity"),
      set({ "pb.filter": "Credit card", "pb.search": "crest" }), press("Search"), text("Crest Card"), noText("Northwind Card"), noText("Pioneer Life"),
      set({ "pb.filter": "Electricity", "pb.search": "" }), press("Search"), text("Home electricity"), text("City Power"), noText("Home internet"), noText("Metro Water"),
      set({ "pb.filter": "all" }), press("Search"), text("Home internet"), text("Metro Water"),
    ],
  },
  {
    id: "T-3", name: "A saved biller opens with its reference filled in", covers: ["AC-1"], ...base,
    steps: [
      press("Home internet"), screen("ref"), text("Skyline Broadband"), text("Internet and phone"), text("5550012345"),
      press("Continue"), screen("amount"), text("Skyline Broadband"), text("Amount due"),
    ],
  },
  {
    id: "T-4", name: "The reference is checked against the biller's format; spaces and hyphens do not count", covers: ["AC-2"], ...base,
    steps: [
      press("City Power"), press("Continue"), screen("ref"), error("pb.ref"),
      set({ "pb.ref": "12345" }), press("Continue"), screen("ref"), error("Enter 10 digits."),
      press("Change"), press("Harbor Insurance"), set({ "pb.ref": "12345678" }), press("Continue"), screen("ref"), error("Enter HI followed by 8 digits."),
      set({ "pb.ref": "hi 1234-5678" }), press("Continue"), screen("amount"), text("HI12345678"),
      press("Back"), press("Change"), press("Northwind Card"), set({ "pb.ref": "123456789012345" }), press("Continue"), error("Enter 16 digits."),
      press("Change"), press("County Revenue"), set({ "pb.ref": "1234567812" }), press("Continue"), error("Enter 12 digits."),
      press("Change"), press("Westbrook University"), set({ "pb.ref": "2026123" }), press("Continue"), error("Enter 8 digits."),
      press("Change"), press("City Power"), set({ "pb.ref": "4400 1234-56" }), press("Continue"), screen("amount"), text("City Power"), text(POWER),
    ],
  },
  {
    id: "T-5", name: "A bill that is found shows the amount due and the due date", covers: ["AC-3"], ...base,
    steps: [...bill("City Power", POWER), screen("amount"), text("Amount due"), text("$322.80"), text("Due"), text("Sun 22 Nov"), noText("Overdue")],
  },
  {
    id: "T-6", name: "Biller unavailable, no bill found, already paid and nothing due each have their own card and the person cannot go on", covers: ["AC-3"], ...base,
    steps: [
      press("City Power"), set({ "pb.ref": "4400121111" }), press("Continue"), screen("refProblem"), text("Biller unavailable"), text("Try again later."), press("Try again"), screen("ref"),
      set({ "pb.ref": "4400120000" }), press("Continue"), screen("refProblem"), text("No bill found"), text("Check the reference and try again."), press("Edit"), screen("ref"),
      set({ "pb.ref": "4400-12 9999" }), press("Continue"), screen("refProblem"), text("Already paid"), text("There is nothing left to pay on this bill."), press("Back"), screen("biller"),
      press("City Power"), set({ "pb.ref": "4400125555" }), press("Continue"), screen("refProblem"), text("No bill due"), text("Nothing to pay on this bill right now."), press("Back"), screen("biller"),
      ...unchanged,
    ],
  },
  {
    id: "T-7", name: "An overdue bill shows the chip and a late fee of 5% in the amount due, which the review names", covers: ["AC-3"], ...base,
    steps: [
      ...bill("City Power", "4400127777"), screen("amount"), text("Overdue"), text("$93.29"), text("$4.44"), text("Sun 25 Oct"),
      press("Continue"), screen("review"), text("Includes late fee"), text("$4.44"), text("$93.29"),
      press("Change amount"), set({ "pb.choice": "other", "pb.amount": 50 }), press("Continue"), screen("review"), noText("Includes late fee"), text("$50.00"),
    ],
  },
  {
    id: "T-8", name: "A card: full, minimum or another amount, with its limits; an amount outside them is refused with the message", covers: ["AC-4"], ...base,
    steps: [
      ...bill("Northwind Card", CARD), text("Pay full amount"), text("$372.80"), text("Pay minimum"), text("$37.28"), text("Other amount"), text("From $37.28 to $671.04"),
      set({ "pb.choice": "other", "pb.amount": 1 }), press("Continue"), screen("amount"), error("The minimum is $37.28."),
      set({ "pb.amount": 671.05 }), press("Continue"), screen("amount"), error("The most you can pay is $671.04."),
      set({ "pb.amount": 671.04 }), press("Continue"), screen("review"), text("$671.04"),
      press("Change amount"), set({ "pb.choice": "min" }), press("Continue"), screen("review"), text("$37.28"),
      ...unchanged,
    ],
  },
  {
    id: "T-9", name: "A loan has a minimum too, and a bill with a minimum can be paid at exactly the minimum", covers: ["AC-4"], ...base,
    steps: [
      ...bill("Lakeside Home Loans", "7700123456"), text("Pay minimum"), text("$17.28"), text("From $17.28 to $172.80"), text("charges a fee of $2.00"),
      set({ "pb.choice": "other", "pb.amount": 17.28 }), press("Continue"), screen("review"), text("Fee"), text("$2.00"),
      press("Change amount"), set({ "pb.amount": 17.27 }), press("Continue"), screen("amount"), error("The minimum is $17.28."),
    ],
  },
  {
    id: "T-10", name: "A biller that takes the full amount only offers only that; another amount is up to the amount due", covers: ["AC-4"], ...base,
    steps: [
      ...bill("Harbor Insurance", INSURANCE), text("Pay full amount"), text("$383.90"), text("This bill can only be paid in full."), noText("Pay minimum"), noText("Other amount"),
      press("Back"), press("Change"), ...bill("City Power", POWER), text("Up to $322.80"), noText("Pay minimum"),
      set({ "pb.choice": "other", "pb.amount": 322.81 }), press("Continue"), screen("amount"), error("The most you can pay is $322.80."),
      set({ "pb.amount": 322.8 }), press("Continue"), screen("review"),
    ],
  },
  {
    id: "T-11", name: "With allowPartial off a card can only be paid in full", covers: ["AC-4"], ...base,
    steps: [
      set({ "opt.allowPartial": false }), ...bill("Northwind Card", CARD),
      text("Pay full amount"), text("This bill can only be paid in full."), noText("Pay minimum"), noText("Other amount"), noText("From $37.28"),
      press("Continue"), screen("review"), text("$372.80"),
    ],
  },
  {
    id: "T-12", name: "Paying from the Euro account shows the rate and what they pay in euros, and takes that from the Euro account", covers: ["AC-5"], ...base,
    steps: [
      ...bill("City Power", POWER), text("EUR Travel"), set({ "pb.from": "acc_eur" }), press("Continue"), screen("review"),
      text("Rate"), text("1 USD = 0.926 EUR"), text("You pay"), text("€298.92"), text("$322.80"), noText("Fee"),
      ...pay(), text("Bill paid"), text("You paid"), text("€298.92"),
      balance("acc_eur", 2101.08), balance("acc_main", 8720.76), balance("acc_save", 15254.37),
    ],
  },
  {
    id: "T-13", name: "A biller's fee is shown as its own line and added to what they pay", covers: ["AC-5"], ...base,
    steps: [
      ...bill("ClearWave Telecom", CLEARWAVE), text("charges a fee of $1.00"), press("Continue"), screen("review"), text("Fee"), text("$1.00"), noText("Rate"),
      ...pay(), text("Fee"), text("$1.00"), balance("acc_main", 8487.06), used(233.7),
    ],
  },
  {
    id: "T-14", name: "With allowCrossCurrency off the Euro account is not listed, and the bank refuses it if it is used", covers: ["AC-5"], ...base,
    steps: [
      set({ "opt.allowCrossCurrency": false }), ...bill("City Power", POWER), text("Main"), text("Savings"), noText("EUR Travel"), noText("AED Home"),
      set({ "pb.from": "acc_eur" }), press("Continue"), screen("amountProblem"), text("Choose an account in the same currency as the bill."), text("Nothing was paid."),
      press("Choose account"), screen("amount"), set({ "pb.from": "acc_save" }), press("Continue"), screen("review"), noText("Rate"),
      ...unchanged,
    ],
  },
  {
    id: "T-15", name: "Not enough in the account is refused before the review, and the most they can pay is accepted", covers: ["AC-6"], ...base, setup: drain,
    steps: [
      ...bill("City Power", POWER), press("Continue"), screen("amountProblem"), text("Not enough in this account."), text("Nothing was paid."), balance("acc_main", 20.76),
      press("Change amount"), screen("amount"), set({ "pb.choice": "other", "pb.amount": 20.77 }), press("Continue"), screen("amountProblem"), text("Not enough in this account."),
      press("Change amount"), set({ "pb.amount": 20.76 }), press("Continue"), screen("review"), text("$20.76"),
    ],
  },
  {
    id: "T-16", name: "An amount over the daily limit is refused before the review; exactly what is left is accepted", covers: ["AC-6"], ...base, conditions: { limitUsed: 49900 },
    steps: [
      ...bill("City Power", POWER), press("Continue"), screen("amountProblem"), text("That is over your daily limit."), text("Nothing was paid."),
      press("Change amount"), set({ "pb.choice": "other", "pb.amount": 100.01 }), press("Continue"), screen("amountProblem"), text("That is over your daily limit."),
      press("Change amount"), set({ "pb.amount": 100 }), press("Continue"), screen("review"), text("$100.00"),
      ...pay(), balance("acc_main", 8620.76), used(50000),
    ],
  },
  {
    id: "T-17", name: "An account that is frozen cannot pay a bill; another can", covers: ["AC-6"], ...base, conditions: { frozen: ["acc_save"] },
    steps: [
      ...bill("City Power", POWER), set({ "pb.from": "acc_save" }), press("Continue"), screen("amountProblem"), text("You can’t pay from this account right now."), text("Nothing was paid."),
      press("Choose account"), screen("amount"), set({ "pb.from": "acc_main" }), press("Continue"), screen("review"),
      ...unchanged,
    ],
  },
  {
    id: "T-18", name: "The amount due goes up by 12.00 once: the review says so with the new amount, and confirming goes to the code", covers: ["AC-7"], ...base,
    steps: [
      ...bill("City Power", "4400123333"), text("$316.65"), press("Continue"), screen("review"),
      text("The amount due changed. Check it and confirm again."), text("$328.65"), balance("acc_main", 8720.76),
      ...confirm, screen("otp"), text("Authorise $328.65 to City Power"), ...code(), press("Pay bill"), screen("success"), balance("acc_main", 8392.11),
    ],
  },
  {
    id: "T-19", name: "The change is told once: asking again shows the new amount with no warning", covers: ["AC-7"], ...base,
    steps: [
      ...bill("City Power", "4400123333"), press("Continue"), screen("review"), text("The amount due changed."),
      press("Change amount"), press("Continue"), screen("review"), noText("The amount due changed."), text("$328.65"),
    ],
  },
  {
    id: "T-20", name: "A code that names the amount and the biller pays the bill: the balance and the daily limit move by it and the receipt says so", covers: ["AC-8"], ...base,
    steps: [
      ...bill("City Power", POWER), press("Continue"), screen("review"), text("You’re paying $322.80 to City Power"), text("Today"), balance("acc_main", 8720.76),
      ...confirm, screen("otp"), text("Authorise $322.80 to City Power"), text("We sent a 6-digit code to"), ...code(), press("Pay bill"),
      screen("success"), text("Bill paid"), text("$322.80 to City Power."), text("Paid"), text("BILL-"), text("Main ••4410"),
      balance("acc_main", 8397.96), used(322.8), balance("acc_save", 15254.37),
    ],
  },
  {
    id: "T-21", name: "Three wrong codes lock the journey and nothing is paid", covers: ["AC-8"], ...base,
    steps: [
      ...bill("City Power", POWER), press("Continue"), ...confirm, ...code("111111"), press("Pay bill"), screen("otp"), press("Pay bill"), screen("otp"), press("Pay bill"),
      screen("locked"), text("Too many wrong codes"), text("No money has left your account."),
      ...unchanged, used(0),
    ],
  },
  {
    id: "T-22", name: "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", covers: ["AC-8"], ...base,
    steps: [
      ...bill("City Power", POWER), press("Continue"), press("Confirm and send code"), screen("review"), error("Tick the confirmation first"),
      ...confirm, screen("otp"), press("Pay bill"), screen("otp"), error("Enter all 6 digits"),
      ...code("12345"), press("Pay bill"), screen("otp"), error("Enter all 6 digits"),
      ...unchanged,
    ],
  },
  {
    id: "T-23", name: "Pay half of a bill: the next lookup shows the rest; pay the rest and the next lookup says it is already paid", covers: ["AC-9"], ...base,
    steps: [
      ...bill("City Power", POWER), set({ "pb.choice": "other", "pb.amount": 100 }), press("Continue"), ...pay(), text("Bill paid"), text("$100.00 to City Power."), text("$222.80 is still due on this bill."),
      balance("acc_main", 8620.76),
      press("Pay another bill"), screen("biller"), ...bill("City Power", POWER), text("$222.80"), noText("$322.80"), press("Continue"), screen("review"), text("$222.80"),
      ...pay(), noText("is still due"), balance("acc_main", 8397.96),
      press("Pay another bill"), ...bill("City Power", POWER), screen("refProblem"), text("Already paid"),
    ],
  },
  {
    id: "T-24", name: "Save this biller and Pay automatically are offered for a biller that is not saved and has a monthly bill", covers: ["AC-10"], ...base,
    steps: [
      ...bill("City Power", POWER2), press("Continue"), screen("review"), text("Save this biller"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("County Revenue", COUNTY), press("Continue"), screen("review"), text("Save this biller"), noText("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Westbrook University", "20261234"), press("Continue"), screen("review"), text("Save this biller"), noText("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Northline Mobile", "5550123456"), press("Continue"), screen("review"), noText("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Home electricity", POWER), press("Continue"), screen("review"), noText("Save this biller"), text("Pay automatically"),
    ],
  },
  {
    id: "T-25", name: "Every category the bank offers Pay automatically for shows it; the others do not", covers: ["AC-10"], ...base,
    steps: [
      ...bill("Metro Water", "3300456712"), press("Continue"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Summit Gas", "2200789012"), press("Continue"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Skyline Broadband", "5550012346"), press("Continue"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Pioneer Life", "6600123478"), press("Continue"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Crest Card", "1234567890124567"), press("Continue"), text("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Lakeside Home Loans", "7700123456"), press("Continue"), text("Pay automatically"),
    ],
  },
  {
    id: "T-26", name: "A tax office, a school and a club have no Pay automatically", covers: ["AC-10"], ...base,
    steps: [
      ...bill("City Council", "8800123456"), press("Continue"), screen("review"), text("Save this biller"), noText("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Greenfield School", "20265678"), press("Continue"), noText("Pay automatically"),
      press("Change amount"), press("Back"), press("Change"), ...bill("Riverside Community Club", "30123456"), press("Continue"), noText("Pay automatically"),
    ],
  },
  {
    id: "T-27", name: "With the options off neither toggle is offered, and nothing is saved or scheduled even if they were set", covers: ["AC-10"], ...base,
    steps: [
      set({ "opt.offerSaveBiller": false, "opt.offerAutopay": false }), ...bill("City Power", POWER2), press("Continue"), screen("review"), noText("Save this biller"), noText("Pay automatically"),
      set({ "pb.save": true, "pb.autopay": true }), ...pay(), noText("Next automatic payment"), noText("is saved."),
      { expectBank: { adapter: "bank.schedules.list", path: "sch_bill1.name", equals: undefined } },
      { expectBank: { adapter: "bank.bills.saved", path: "sb_new1.nickname", equals: undefined } },
    ],
  },
  {
    id: "T-28", name: "Save this biller and Pay automatically: the receipt names the next automatic payment, the biller is saved and a monthly entry is made", covers: ["AC-10"], ...base,
    steps: [
      ...bill("City Power", POWER2), press("Continue"), screen("review"), set({ "pb.save": true, "pb.autopay": true }), ...pay(),
      text("Next automatic payment"), text("Wed 23 Dec"), text("City Power is saved."),
      { expectBank: { adapter: "bank.schedules.list", path: "sch_bill1.text", equals: "City Power · Monthly, Wed 23 Dec, full bill, up to $490.00" } },
      { expectBank: { adapter: "bank.bills.saved", path: "sb_new1.nickname", equals: "City Power" } },
      { expectBank: { adapter: "bank.bills.saved", path: "sb_new1.reference", equals: POWER2 } },
      balance("acc_main", 8397.91),
      press("Pay another bill"), screen("biller"), text("City Power ••3457"),
    ],
  },
  {
    id: "T-29", name: "With billFetch off no lookup is made: the reference screen says the amount comes next, and the person types it", covers: ["AC-11"], ...base,
    conditions: { unavailable: ["bank.bills.lookup"] },
    steps: [
      set({ "opt.billFetch": false }), press("City Power"), text("Enter the amount on the next screen."),
      set({ "pb.ref": "12345" }), press("Continue"), screen("ref"), error("Enter 10 digits."),
      set({ "pb.ref": POWER }), press("Continue"), screen("amount"), noText("Pay full amount"), noText("Amount due"), noText("Due"),
      press("Continue"), screen("amount"), error("pb.amount"),
      set({ "pb.amount": 25.5 }), press("Continue"), screen("review"), text("$25.50"), noText("Pay automatically"),
      ...pay(), balance("acc_main", 8695.26),
    ],
  },
  {
    id: "T-30", name: "The bank does not answer in time when paying: Check Activity first, nothing paid", covers: ["AC-12"], ...base,
    conditions: { timeout: ["bank.bills.pay"], latencyMs: 10000 },
    steps: [
      ...bill("City Power", POWER), press("Continue"), ...confirm, ...code(), press("Pay bill"),
      screen("timeout"), text("We didn't get an answer in time"), text("Check Activity before you try again"), press("Check Activity"),
      ...unchanged, used(0),
    ],
  },
  {
    id: "T-31", name: "The bank is unavailable when paying: nothing paid, and Try again goes back to the review", covers: ["AC-12"], ...base,
    conditions: { unavailable: ["bank.bills.pay"] },
    steps: [
      ...bill("City Power", POWER), press("Continue"), ...confirm, ...code(), press("Pay bill"),
      screen("unavailable"), text("Service not available"), text("Nothing was paid."), press("Try again"), screen("review"),
      ...unchanged,
    ],
  },
  {
    id: "T-32", name: "The core fails after the code: no money has left the account", covers: ["AC-12"], ...base, conditions: { transferFails: true },
    steps: [
      ...bill("City Power", POWER), press("Continue"), ...confirm, ...code(), press("Pay bill"),
      screen("failed"), text("We couldn't complete this right now."), text("No money has left your account."),
      ...unchanged,
    ],
  },
  {
    id: "T-33", name: "The directory cannot be loaded: standard message, and Try again asks again", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.billers.list"] },
    steps: [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-34", name: "The saved billers cannot be loaded: standard message", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.bills.saved"] },
    steps: [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-35", name: "The bill cannot be looked up: standard message, and Try again returns to the reference", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.bills.lookup"] },
    steps: [press("City Power"), set({ "pb.ref": POWER }), press("Continue"), screen("unavailable"), press("Try again"), screen("ref"), ...unchanged],
  },
  {
    id: "T-36", name: "The biller is slow to answer the lookup: nothing was paid and the person can try again", covers: ["AC-12"], ...base, conditions: { timeout: ["bank.bills.lookup"], latencyMs: 10000 },
    steps: [
      press("City Power"), set({ "pb.ref": POWER }), press("Continue"), screen("slow"), text("This is taking longer than expected."), text("Nothing was paid."), press("Try again"), screen("ref"),
      ...unchanged,
    ],
  },
  {
    id: "T-37", name: "The accounts cannot be loaded after the lookup: standard message, and Try again returns to the reference", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [press("City Power"), set({ "pb.ref": POWER }), press("Continue"), screen("unavailable"), press("Try again"), screen("ref")],
  },
  {
    id: "T-38", name: "With billFetch off the accounts cannot be loaded either: standard message", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [set({ "opt.billFetch": false }), press("City Power"), set({ "pb.ref": POWER }), press("Continue"), screen("unavailable")],
  },
  {
    id: "T-39", name: "The amount cannot be checked: standard message, and Try again returns to the amount", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.bills.quote"] },
    steps: [...bill("City Power", POWER), press("Continue"), screen("unavailable"), press("Try again"), screen("amount"), ...unchanged],
  },
  {
    id: "T-40", name: "The code cannot be sent: standard message, nothing paid", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...bill("City Power", POWER), press("Continue"), ...confirm, screen("unavailable"), press("Try again"), screen("review"), ...unchanged],
  },
];
