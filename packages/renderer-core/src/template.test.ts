import { describe, expect, it } from "vitest";
import { interpolate } from "./template";

describe("money with a currency", () => {
  it("formats in the named currency, or the one on the data", () => {
    expect(interpolate("{{ amt | money:JOD }}", { amt: 12.5 })).toBe("JOD 12.500");
    expect(interpolate("{{ amt | money:USD }}", { amt: 1234.5 })).toBe("$1,234.50");
    expect(interpolate("{{ amt | money:account.currency }}", { amt: 5000, account: { currency: "JPY" } })).toBe("¥5,000");
    expect(interpolate("{{ amt | money }}", { amt: 5000 })).toBe("5,000");
    expect(interpolate("{{ amt | money:nope.currency }}", { amt: 5000 })).toBe("5,000");
  });
});
