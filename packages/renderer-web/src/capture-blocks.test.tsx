import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { JourneyRunner } from "@finx/renderer-core";
import { Journey } from "@finx/journey-schema";
import { axeCheck, renderBlock } from "./test-utils";
import { JourneyPlayer } from "./JourneyPlayer";

expect.extend(matchers as any);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const journey = (blocks: any[], extra: any = {}) => Journey.parse({ id: "j", slug: "j", name: "J", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en"] }, entryScreen: "s", dataModel: {}, integrations: [], screens: [{ id: "s", title: "S", blocks }], ...extra });
async function resolved(block: any, data: Record<string, any> = {}) {
  const r = new JourneyRunner(journey([block]), { adapter: async () => ({}), launch: data });
  await r.start();
  return r.view().blocks[0]!;
}

describe("fileUpload", () => {
  const BLOCK = { type: "fileUpload", bind: "up", label: "Payment file", accept: ["csv", "xml"] };
  it("is a labelled file input that accepts only the allowed kinds, with its hint tied to it", async () => {
    const { container } = renderBlock("fileUpload", await resolved(BLOCK));
    const input = screen.getByLabelText("Payment file") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".csv,.xml");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe("CSV or XML, up to 256 KB.");
    expect(await axeCheck(container)).toHaveNoViolations();
  });
  it("reads a csv file into the answer, with its text", async () => {
    const set = vi.fn();
    renderBlock("fileUpload", await resolved(BLOCK), { set });
    await userEvent.upload(screen.getByLabelText("Payment file"), new File(["name,amount\nZeta,10"], "october.csv", { type: "text/csv" }));
    await waitFor(() => expect(set).toHaveBeenCalledWith("up", { name: "october.csv", size: 19, kind: "csv", content: "name,amount\nZeta,10" }));
  });
  it("refuses a file of the wrong kind in words, and saves nothing", async () => {
    const set = vi.fn();
    renderBlock("fileUpload", await resolved(BLOCK), { set });
    // the input's own accept list would filter this in a browser; a drop does not
    fireEvent.drop(screen.getByLabelText("Payment file").closest(".fxc-file-zone")!, { dataTransfer: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    expect((await screen.findByRole("alert")).textContent).toBe("Use a CSV or XML file.");
    expect(set).not.toHaveBeenCalled();
  });
  it("shows the chosen file with its size, and removes it", async () => {
    const set = vi.fn();
    const { container } = renderBlock("fileUpload", await resolved(BLOCK, { up: { name: "october.csv", size: 12 * 1024, kind: "csv" } }), { set });
    expect(screen.getByText("october.csv")).toBeTruthy();
    expect(screen.getByText("12 KB")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(set).toHaveBeenCalledWith("up", undefined);
  });
});

describe("documentViewer", () => {
  const BLOCK = { type: "documentViewer", bind: "read", title: "Terms of use", text: "## One\nFirst.\n\nSecond." };
  const sizes = (scrollHeight: number, clientHeight: number) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
  };
  it("is a focusable, named region; it marks the document read only when the end is reached", async () => {
    sizes(1000, 100);
    const set = vi.fn();
    const { container } = renderBlock("documentViewer", await resolved(BLOCK), { set });
    const region = screen.getByRole("region", { name: "Terms of use" });
    expect(region.tabIndex).toBe(0);
    expect(screen.getByText("Scroll to the end to continue.")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
    fireEvent.scroll(region, { target: { scrollTop: 300 } });
    expect(set).not.toHaveBeenCalled();
    fireEvent.scroll(region, { target: { scrollTop: 900 } });
    expect(set).toHaveBeenCalledWith("read", true);
  });
  it("counts a text that fits without scrolling as read", async () => {
    sizes(100, 240);
    const set = vi.fn();
    renderBlock("documentViewer", await resolved(BLOCK), { set });
    expect(set).toHaveBeenCalledWith("read", true);
  });
  it("says so once it was read", async () => {
    sizes(1000, 100);
    renderBlock("documentViewer", await resolved(BLOCK, { read: true }));
    expect(screen.getByText(/You have read the whole document/)).toBeTruthy();
  });
});

describe("signature", () => {
  const BLOCK = { type: "signature", bind: "sig", label: "Sign here" };
  it("types a name with a keyboard, as a plain labelled field, and previews it", async () => {
    const set = vi.fn();
    const { container } = renderBlock("signature", await resolved(BLOCK, { sig: { mode: "type", name: "Alex" } }), { set });
    const input = screen.getByLabelText("Type your full name") as HTMLInputElement;
    expect(input.value).toBe("Alex");
    await userEvent.type(input, "!");
    expect(set).toHaveBeenLastCalledWith("sig", { mode: "type", name: "Alex!" });
    expect(await axeCheck(container)).toHaveNoViolations();
  });
  it("offers drawing too, and saves the line with its point count", async () => {
    const set = vi.fn();
    renderBlock("signature", await resolved(BLOCK), { set });
    await userEvent.click(screen.getByRole("radio", { name: "Draw" }));
    const pad = screen.getByRole("img", { name: /Signature box/ });
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    for (let i = 0; i < 14; i++) fireEvent.pointerMove(pad, { clientX: 10 + i * 5, clientY: 10 + i, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    const call = set.mock.calls.at(-1)!;
    expect(call[0]).toBe("sig");
    expect(call[1]).toMatchObject({ mode: "draw" });
    expect(call[1].points).toBe(15);
    expect(call[1].path.startsWith("M")).toBe(true);
  });
  it("offers no choice when only one way is allowed", async () => {
    renderBlock("signature", await resolved({ ...BLOCK, modes: ["type"] }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("idCapture", () => {
  const BLOCK = { type: "idCapture", bind: "kyc", label: "Verify your identity", steps: ["front", "selfie"] };
  it("lists the steps with a button each, says it is simulated, and saves a counted reference", async () => {
    const set = vi.fn();
    const { container } = renderBlock("idCapture", await resolved(BLOCK, { kyc: { front: { ref: "SIM-FRONT-1" } } }), { set });
    expect(screen.getByText(/Simulated: no camera/)).toBeTruthy();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Front of the documentCaptured · SIM-FRONT-1Retake", "SelfieLook at the camera in good light.Capture"]);
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Capture: Selfie" }));
    expect(set).toHaveBeenCalledWith("kyc", { front: { ref: "SIM-FRONT-1" }, selfie: { ref: "SIM-SELFIE-1" } });
    await userEvent.click(screen.getByRole("button", { name: "Retake: Front of the document" }));
    expect(set).toHaveBeenLastCalledWith("kyc", { front: { ref: "SIM-FRONT-2" } });
  });
});

describe("receipts in the player", () => {
  const j = journey([{ type: "button", label: "Next", actions: [{ type: "navigate", to: "end" }] }], {
    screens: [
      { id: "s", title: "S", blocks: [{ type: "button", label: "Next", actions: [{ type: "navigate", to: "end" }] }] },
      { id: "end", title: "Done", kind: "terminal", blocks: [{ type: "result", tone: "success", title: "Paid", meta: "Ref 77" }, { type: "reviewSummary", rows: [{ label: "Amount", value: "$5.00" }] }, { type: "button", label: "Receipt", actions: [{ type: "share", template: "receipt" }] }] },
    ],
  });
  it("prints the receipt: it is put on the page, the browser's print dialog opens, and it goes away afterwards", async () => {
    const print = vi.fn();
    window.print = print;
    render(<JourneyPlayer journey={j} adapter={async () => ({})} />);
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Receipt" }));
    const receipt = await screen.findByRole("document", { name: "Paid" });
    expect(print).toHaveBeenCalledTimes(1);
    expect(receipt.textContent).toBe("PaidAmount$5.00Ref 77");
    fireEvent(window, new Event("afterprint"));
    await waitFor(() => expect(screen.queryByRole("document")).toBeNull());
  });
  it("hands the receipt to the app instead when the app wants it", async () => {
    const onShare = vi.fn();
    window.print = vi.fn();
    render(<JourneyPlayer journey={j} adapter={async () => ({})} onShare={onShare} />);
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Receipt" }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ title: "Paid", text: "Paid\nAmount: $5.00\nRef 77" }));
    expect(window.print).not.toHaveBeenCalled();
  });
  it("hides a block the person's permissions do not allow", async () => {
    const gated = journey([{ type: "text", text: "Pay a supplier", visibleWhen: "has(session.permissions, 'biz.payments.initiate')" }, { type: "text", text: "Ask your administrator" }]);
    const { unmount } = render(<JourneyPlayer journey={gated} adapter={async () => ({})} session={{ permissions: ["biz.approvals.view"] }} />);
    expect(await screen.findByText("Ask your administrator")).toBeTruthy();
    expect(screen.queryByText("Pay a supplier")).toBeNull();
    unmount();
    render(<JourneyPlayer journey={gated} adapter={async () => ({})} session={{ permissions: ["biz.payments.initiate"] }} />);
    expect(await screen.findByText("Pay a supplier")).toBeTruthy();
  });
});
