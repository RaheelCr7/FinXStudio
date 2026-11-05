/** Built-in UI strings used by renderers when a journey does not provide its own text. */
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    step: "Step {n} of {total}", required: "Required", enterAmount: "Enter an amount", minimum: "Minimum is {n}", maximum: "Maximum is {n}",
    allDigits: "Enter all {n} digits", invalid: "Invalid format", account: "Account", payTo: "Pay to", addBeneficiary: "+ Add new beneficiary",
    wait: "Please wait…", back: "Back", close: "Close", journeyNotLoaded: "This step opens another journey, which is not loaded here.",
    cardNumber: "Enter a valid card number", cardExpiry: "Enter a valid expiry date (MM/YY)", cardCvv: "Enter the 3 or 4 digit code", cardHolder: "Enter the name on the card",
    cardNumberLabel: "Card number", cardHolderLabel: "Name on card", cardHolderPlaceholder: "As shown on the card", cardExpiryLabel: "Expiry", cardCvvLabel: "Security code",
    dateInvalid: "Choose a real date", dateTooEarly: "That date is too early", dateTooLate: "That date is too late", pickDate: "Choose a date", prevMonth: "Previous month", nextMonth: "Next month", prevYear: "Previous year", nextYear: "Next year",
    show: "Show", hide: "Hide", otpLabel: "One-time code, {n} digits", quickAmounts: "Quick amounts", amountWhole: "Enter a whole amount, without decimals", amountDecimals: "Use at most {n} decimal places",
  },
  ur: {
    step: "مرحلہ {n} از {total}", required: "ضروری ہے", enterAmount: "رقم درج کریں", minimum: "کم از کم {n} ہے", maximum: "زیادہ سے زیادہ {n} ہے",
    allDigits: "تمام {n} ہندسے درج کریں", invalid: "غلط فارمیٹ", account: "اکاؤنٹ", payTo: "وصول کنندہ", addBeneficiary: "+ نیا وصول کنندہ شامل کریں",
    wait: "براہ کرم انتظار کریں…", back: "واپس", close: "بند کریں",
    cardNumber: "درست کارڈ نمبر درج کریں", cardExpiry: "درست میعاد (MM/YY) درج کریں", cardCvv: "3 یا 4 ہندسوں کا کوڈ درج کریں", cardHolder: "کارڈ پر درج نام لکھیں",
    cardNumberLabel: "کارڈ نمبر", cardHolderLabel: "کارڈ پر نام", cardHolderPlaceholder: "جیسا کارڈ پر درج ہے", cardExpiryLabel: "میعاد", cardCvvLabel: "سیکیورٹی کوڈ", amountWhole: "پوری رقم درج کریں، اعشاریہ کے بغیر", amountDecimals: "زیادہ سے زیادہ {n} اعشاریہ ہندسے",
    dateInvalid: "درست تاریخ منتخب کریں", dateTooEarly: "یہ تاریخ بہت پہلے کی ہے", dateTooLate: "یہ تاریخ بہت آگے کی ہے", pickDate: "تاریخ منتخب کریں", prevMonth: "پچھلا مہینہ", nextMonth: "اگلا مہینہ", prevYear: "پچھلا سال", nextYear: "اگلا سال",
    show: "دکھائیں", hide: "چھپائیں", otpLabel: "ایک بار استعمال ہونے والا کوڈ، {n} ہندسے", quickAmounts: "فوری رقم",
  },
};

export function ui(lang: string, key: string, vars: Record<string, string | number> = {}): string {
  const raw = STRINGS[lang]?.[key] ?? STRINGS.en![key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ""));
}
