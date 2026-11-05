import { render } from "@testing-library/react";
import { vi } from "vitest";
import { axe } from "vitest-axe";
import { AppProvider, type ProjectInfo } from "./AppProvider";

export const BANKWORKX: ProjectInfo = { id: "bankworkx", preset: "bankworkx", name: "BankWorkx", shell: "bankworkx", currency: "USD" };
/** BankWorkx with its real sign-in (the sign-in journey); the sandbox customer picker is then for development only. */
export const BANKWORKX_SIGNIN: ProjectInfo = { ...BANKWORKX, signIn: true };
/** The same bank with the sign-in page set to the dark stage in its look. */
export const BANKWORKX_STAGE: ProjectInfo = { ...BANKWORKX_SIGNIN, look: { signIn: "stage" } };
export const MEEZAN: ProjectInfo = { id: "meezan", preset: "meezan", name: "Meezan Digital", shell: "meezan", currency: "PKR" };

export const nav = { push: vi.fn(), replace: vi.fn(), params: {} as Record<string, string>, path: "/", search: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.path,
  useParams: () => nav.params,
  useSearchParams: () => nav.search,
}));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

/** Renders a page inside its bank's app store, signed in as the first customer unless told otherwise. */
export function renderPage(ui: React.ReactNode, project: ProjectInfo, opts: { signedIn?: boolean; personaId?: string; lang?: string } = {}) {
  sessionStorage.setItem("finx.session", JSON.stringify({ project: project.id, personaId: opts.personaId ?? (project.shell === "bankworkx" ? "alex" : "ayesha"), lang: opts.lang ?? "en", signedIn: opts.signedIn ?? true }));
  return render(<AppProvider project={project}>{ui}</AppProvider>);
}

/** Colour contrast needs real layout; it is checked on the theme tokens instead. */
export const axeCheck = (el: HTMLElement) => axe(el, { rules: { "color-contrast": { enabled: false } } });
