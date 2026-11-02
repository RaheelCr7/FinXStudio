import { describe, it, expect } from "vitest";
import { originAllowed } from "./origin";

describe("originAllowed", () => {
  it("allows requests with no Origin header (MCP server, curl, native apps)", () => {
    expect(originAllowed(null)).toBe(true);
    expect(originAllowed(undefined)).toBe(true);
  });
  it("allows local development origins on any port", () => {
    for (const o of ["http://localhost:8081", "http://localhost:3100", "http://127.0.0.1:19006", "https://localhost", "http://[::1]:3000"]) expect(originAllowed(o)).toBe(true);
  });
  it("refuses other sites, look-alike hosts and the literal null origin", () => {
    for (const o of ["https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.evil.example:3100", "http://evil.example:3100", "null", "http://localhostx"]) expect(originAllowed(o, "")).toBe(false);
  });
  it("allows explicitly configured origins", () => {
    expect(originAllowed("https://bank.example", "https://bank.example, https://uat.bank.example")).toBe(true);
    expect(originAllowed("https://other.example", "https://bank.example")).toBe(false);
  });
});
