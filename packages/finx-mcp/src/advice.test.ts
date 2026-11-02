import { describe, expect, it } from "vitest";
import { payBill } from "@finx/journey-schema";
import { adviceFor, lintForAgent } from "./advice";

describe("advice for authors", () => {
  it("a text input with a format but no message is flagged; the shipped journey is not", () => {
    expect(adviceFor(payBill).join(" ")).not.toContain("patternMessage");
    const j = structuredClone(payBill);
    delete (j.screens[0]!.blocks[2] as any).patternMessage;
    expect(adviceFor(j).join(" ")).toContain('text input "bill.reference" has a format but no patternMessage');
  });

  it("flags callApi without onError, and a money-moving journey without a failed screen", () => {
    const j = structuredClone(payBill);
    const advice = adviceFor(j).join("\n");
    expect(advice).toContain('callApi "accounts" has no onError');
    const noFail = structuredClone(payBill);
    noFail.screens.find((s) => s.id === "failed")!.blocks = noFail.screens.find((s) => s.id === "failed")!.blocks.filter((b) => b.type !== "result");
    expect(adviceFor(noFail).join("\n")).toContain("should end in a failed screen");
  });

  it("flags optional-looking inputs that the data model does not require", () => {
    const j = structuredClone(payBill);
    j.dataModel!["bill.reference"]!.required = false;
    expect(adviceFor(j).join("\n")).toContain('"bill.reference" is not marked required');
  });

  it("blocks on integrations that do not exist and on a mis-named OTP verifier", () => {
    const j = structuredClone(payBill);
    j.integrations.push({ id: "x", adapter: "bank.nope", mode: "sandbox" });
    expect(lintForAgent(j).map((i) => i.code)).toContain("unknown_adapter");
  });
});
