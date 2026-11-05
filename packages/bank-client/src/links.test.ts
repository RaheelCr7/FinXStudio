import { describe, expect, it } from "vitest";
import { deepLink, linkContext, linkPath, needsSwitch, parseLink } from "./links";

describe("links", () => {
  it("reads web paths and deep links the same way", () => {
    expect(parseLink("/personal/cards")).toEqual({ workspace: "personal", tab: "cards" });
    expect(parseLink("bankworkx://personal/cards", "bankworkx")).toEqual({ workspace: "personal", tab: "cards" });
    expect(parseLink("/business/alpha/approvals")).toEqual({ workspace: "business", companyId: "alpha", tab: "approvals" });
    expect(parseLink("/business/beta")).toEqual({ workspace: "business", companyId: "beta", tab: "overview" });
    expect(parseLink("/personal")).toEqual({ workspace: "personal", tab: "home" });
    expect(parseLink("/personal/j/freeze-card?cardId=card_debit")).toEqual({ workspace: "personal", journey: "freeze-card", values: { cardId: "card_debit" } });
    expect(parseLink("bankworkx://business/beta/j/approve-payments?paymentId=PAY-2041", "bankworkx")).toEqual({ workspace: "business", companyId: "beta", journey: "approve-payments", values: { paymentId: "PAY-2041" } });
  });
  it("round-trips through linkPath and deepLink", () => {
    for (const p of ["/personal/save", "/business/alpha/payments", "/personal/j/statement?accountId=acc_main", "/business/beta/j/approve-payments?paymentId=PAY-2041"]) expect(linkPath(parseLink(p)!)).toBe(p);
    expect(deepLink("bankworkx", parseLink("/business/beta/approvals")!)).toBe("bankworkx://business/beta/approvals");
  });
  it("refuses anything that is not a known place, another scheme, odd slugs and odd values", () => {
    for (const bad of ["/", "/public/cards", "/personal/admin", "/business/alpha/cards", "/business", "/business/../x/home", "/personal/cards/extra", "/personal/j", "/personal/j/Bad_Slug", "/personal/j/a/b", "/business/a b/overview", "https://evil.example/personal/cards", "javascript:alert(1)"]) expect(parseLink(bad, "bankworkx"), bad).toBeNull();
    expect(parseLink("otherapp://personal/cards", "bankworkx")).toBeNull();
  });
  it("lets through only plain value names and short values", () => {
    const l = parseLink(`/personal/j/statement?accountId=acc_main&__proto__=x&a-b=1&long=${"x".repeat(121)}&empty=&second=1&second=2`)!;
    expect(l.values).toEqual({ accountId: "acc_main", second: "1" });
    expect(Object.getPrototypeOf(l.values)).toBe(Object.prototype);
  });
  it("knows which place a link belongs to, and when following it means switching", () => {
    const beta = parseLink("/business/beta/approvals")!;
    expect(linkContext(beta)).toBe("beta");
    expect(needsSwitch(beta, "personal")).toBe(true);
    expect(needsSwitch(beta, "beta")).toBe(false);
    expect(needsSwitch(parseLink("/personal/home")!, "alpha")).toBe(true);
  });
});
