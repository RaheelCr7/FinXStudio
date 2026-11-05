/**
 * A phone number as a screen may show it: the country code stays, every digit is hidden except the last four ("+1 415 555 0142"
 * becomes "+1 ••• ••• 0142"). A number written without spaces is masked the same way, apart from its last four digits.
 */
export function maskPhone(phone: string): string {
  const parts = phone.trim().split(/\s+/);
  const hide = (s: string) => s.replace(/\d(?=(?:\D*\d){4})/g, "•");
  if (parts.length < 2) return hide(phone);
  const [code, ...rest] = parts;
  return `${code} ${hide(rest.join(" "))}`;
}
