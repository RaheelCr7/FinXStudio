/**
 * The sign-in screen's logic that needs no browser: what counts as a complete form, the words for each answer the
 * sign-in API can give, and the "remember me" choice (which keeps only the person id, never a password).
 */
export type SignInInput = { person: string; password: string };
export type FieldErrors = Partial<Record<keyof SignInInput, string>>;

/** Person ids are lower-case words like "alex"; the API lower-cases too, so "Alex " still signs Alex in. */
export const normalisePerson = (s: string) => s.trim().toLowerCase();

export function validateSignIn(input: SignInInput): FieldErrors {
  const errors: FieldErrors = {};
  const person = normalisePerson(input.person);
  if (!person) errors.person = "Enter your person id";
  else if (/\s/.test(person)) errors.person = "A person id has no spaces";
  else if (person.length > 64) errors.person = "That person id is too long";
  if (!input.password) errors.password = "Enter your password";
  return errors;
}

export type SignInOutcome = { kind: "ok" } | { kind: "error"; message: string; locked: boolean };

/**
 * What to tell the person for an answer from POST /api/auth/login. The server's own words are shown when it gave some;
 * a lockout (429) says how long to wait, from Retry-After.
 */
export function signInOutcome(status: number, body: unknown, retryAfterSeconds?: number): SignInOutcome {
  if (status >= 200 && status < 300) return { kind: "ok" };
  const said = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "";
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil((retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : 15 * 60) / 60));
    return { kind: "error", locked: true, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }
  if (status === 401) return { kind: "error", locked: false, message: said || "That name or password is not right" };
  if (status === 404) return { kind: "error", locked: false, message: "Sign-in is only used in the production profile" };
  return { kind: "error", locked: false, message: said || "Could not sign in. Try again." };
}

/** Where "remember me" keeps the person id on this device. */
export const REMEMBER_KEY = "finx.signin.person";
type KeyValueStore = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

export function rememberedPerson(store: KeyValueStore | null | undefined): string {
  try { return store?.getItem(REMEMBER_KEY) ?? ""; } catch { return ""; }
}
export function rememberPerson(store: KeyValueStore | null | undefined, person: string, remember: boolean): void {
  const id = normalisePerson(person);
  try { if (remember && id) store?.setItem(REMEMBER_KEY, id); else store?.removeItem(REMEMBER_KEY); } catch { /* private mode or storage off: nothing to remember */ }
}
