import { describe, expect, it } from "vitest";
import { acceptAttr, acceptedText, captureProblem, captureRows, captureSteps, docParagraphs, fileHint, fileKindOf, fileMessage, fileProblem, fileValue, nextCapture, receiptText, signatureProblem, sizeText } from "./index";

describe("files", () => {
  it("knows a file's kind from its name, whatever the case", () => {
    expect(["a.CSV", "b.xml", "c.pdf", "d.PNG", "e.jpeg", "f.exe", "noext"].map(fileKindOf)).toEqual(["csv", "xml", "pdf", "image", "image", undefined, undefined]);
  });
  it("refuses a wrong kind, an empty file and one over the limit of its kind", () => {
    const f = (name: string, size: number) => fileProblem({ name, size }, ["csv", "xml"]);
    expect([f("p.csv", 100), f("p.pdf", 100), f("p.csv", 0), f("p.csv", 256 * 1024), f("p.csv", 256 * 1024 + 1)]).toEqual([undefined, "type", "empty", undefined, "size"]);
    expect(fileProblem({ name: "scan.png", size: 5 * 1024 * 1024 }, ["image"])).toBeUndefined();
    expect(fileProblem({ name: "scan.png", size: 11 * 1024 * 1024 }, ["image"])).toBe("size");
    expect(fileProblem({ name: "p.csv", size: 2048 }, ["csv"], 1)).toBe("size");
  });
  it("writes the allowed kinds, the size and the messages in words", () => {
    expect(acceptAttr(["csv", "image"])).toBe(".csv,.jpg,.jpeg,.png");
    expect([acceptedText(["csv"]), acceptedText(["csv", "xml"]), acceptedText(["pdf", "image", "csv"])]).toEqual(["CSV", "CSV or XML", "PDF, JPG or PNG or CSV"]);
    expect([sizeText(12), sizeText(2048), sizeText(1.5 * 1024 * 1024)]).toEqual(["12 B", "2 KB", "1.5 MB"]);
    expect(fileHint("en", ["csv", "xml"])).toBe("CSV or XML, up to 256 KB.");
    expect(fileHint("en", ["pdf"])).toBe("PDF, up to 10 MB.");
    expect(fileMessage("en", "type", ["csv", "xml"])).toBe("Use a CSV or XML file.");
    expect(fileMessage("en", "size", ["csv"])).toBe("The file is larger than 256 KB.");
  });
  it("keeps the text of a csv or xml file, and only the name and size of the rest", () => {
    expect(fileValue({ name: "p.csv", size: 3 }, "a,b")).toEqual({ name: "p.csv", size: 3, kind: "csv", content: "a,b" });
    expect(fileValue({ name: "id.pdf", size: 3 }, "%PDF")).toEqual({ name: "id.pdf", size: 3, kind: "pdf" });
  });
});

describe("documents", () => {
  it("splits a text at blank lines and takes a ## line as the heading of its paragraph", () => {
    expect(docParagraphs("Intro line\ncontinues.\n\n## One\nFirst.\n\n\n## Two\nSecond.")).toEqual([{ text: "Intro line continues." }, { heading: "One", text: "First." }, { heading: "Two", text: "Second." }]);
    expect(docParagraphs("")).toEqual([]);
  });
});

describe("signature", () => {
  it("wants a name of two letters, matching the expected one when given, ignoring case and spacing", () => {
    expect(signatureProblem("en", { mode: "type", name: "A" })).toBe("Type your full name.");
    expect(signatureProblem("en", { mode: "type", name: "  alex   MORGAN " }, "Alex Morgan")).toBeUndefined();
    expect(signatureProblem("en", { mode: "type", name: "Alexa Morgan" }, "Alex Morgan")).toBe("Type your name exactly as it is on your profile.");
  });
  it("wants a drawing of more than a dot", () => {
    expect(signatureProblem("en", { mode: "draw", path: "M1 1", points: 1 })).toBe("Draw your signature in the box.");
    expect(signatureProblem("en", { mode: "draw", path: "M1 1 L2 2", points: 20 })).toBeUndefined();
    expect(signatureProblem("en", undefined)).toBeUndefined();
  });
});

describe("id capture", () => {
  it("captures front and selfie by default, and counts retakes instead of using the clock", () => {
    expect(captureSteps(undefined)).toEqual(["front", "selfie"]);
    const one = nextCapture(undefined, "front");
    expect(one).toEqual({ front: { ref: "SIM-FRONT-1" } });
    expect(nextCapture(one, "front")).toEqual({ front: { ref: "SIM-FRONT-2" } });
    expect(nextCapture(one, "selfie")).toEqual({ front: { ref: "SIM-FRONT-1" }, selfie: { ref: "SIM-SELFIE-1" } });
  });
  it("says which steps are done and which are still to do", () => {
    const v = nextCapture(undefined, "front");
    expect(captureRows(v, ["front", "selfie"], "en").map((r) => [r.id, r.done])).toEqual([["front", true], ["selfie", false]]);
    expect(captureProblem("en", v, ["front", "selfie"])).toBe("Still to capture: selfie.");
    expect(captureProblem("en", nextCapture(v, "selfie"), ["front", "selfie"])).toBeUndefined();
    expect(captureProblem("en", undefined, ["front", "back"])).toBe("Still to capture: front of the document, back of the document.");
  });
});

describe("receipt text", () => {
  it("is the title, then one line per row", () => {
    expect(receiptText("Receipt", [{ label: "Amount", value: "$5.00" }, { label: "", value: "Ref 1" }])).toBe("Receipt\nAmount: $5.00\nRef 1");
  });
});
