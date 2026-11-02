/** Built-in UI strings used by renderers when a journey does not provide its own text. */
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    step: "Step {n} of {total}", required: "Required", enterAmount: "Enter an amount", minimum: "Minimum is {n}", maximum: "Maximum is {n}",
    allDigits: "Enter all {n} digits", invalid: "Invalid format", account: "Account", payTo: "Pay to", addBeneficiary: "+ Add new beneficiary",
    wait: "Please wait…", back: "Back", close: "Close",
    cardNumber: "Enter a valid card number", cardExpiry: "Enter a valid expiry date (MM/YY)", cardCvv: "Enter the 3 or 4 digit code", cardHolder: "Enter the name on the card",
  },
  ur: {
    step: "مرحلہ {n} از {total}", required: "ضروری ہے", enterAmount: "رقم درج کریں", minimum: "کم از کم {n} ہے", maximum: "زیادہ سے زیادہ {n} ہے",
    allDigits: "تمام {n} ہندسے درج کریں", invalid: "غلط فارمیٹ", account: "اکاؤنٹ", payTo: "وصول کنندہ", addBeneficiary: "+ نیا وصول کنندہ شامل کریں",
    wait: "براہ کرم انتظار کریں…", back: "واپس", close: "بند کریں",
    cardNumber: "درست کارڈ نمبر درج کریں", cardExpiry: "درست میعاد (MM/YY) درج کریں", cardCvv: "3 یا 4 ہندسوں کا کوڈ درج کریں", cardHolder: "کارڈ پر درج نام لکھیں",
  },
};

export function ui(lang: string, key: string, vars: Record<string, string | number> = {}): string {
  const raw = STRINGS[lang]?.[key] ?? STRINGS.en![key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ""));
}
