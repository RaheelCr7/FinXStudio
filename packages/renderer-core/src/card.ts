/** Luhn check: the standard test for a plausible card number. Spaces are ignored. */
export function luhnValid(num: string): boolean {
  const d = num.replace(/\s/g, "");
  if (!/^[0-9]{13,19}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** MM/YY that has not passed yet. The card is good through the last day of its month (by the person's own calendar, or by UTC when `utc` is set, for a fixed clock). */
export function cardExpiryValid(expiry: string, now = new Date(), utc = false): boolean {
  const m = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.exec(expiry.trim());
  if (!m) return false;
  const year = 2000 + Number(m[2]), month = Number(m[1]);
  const end = utc ? Date.UTC(year, month, 0, 23, 59, 59) : new Date(year, month, 0, 23, 59, 59).getTime();
  return end >= now.getTime();
}
