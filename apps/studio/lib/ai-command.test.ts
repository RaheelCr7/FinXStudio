import { describe, it, expect } from "vitest";
import { commandFor } from "./ai-command";

describe("Claude Code commands", () => {
  it("builds a journey command, with a placeholder until the person writes one", () => {
    expect(commandFor("journey", "Create a top-up journey")).toBe("claude '/finx-journey Create a top-up journey'");
    expect(commandFor("journey", "")).toBe("claude '/finx-journey <describe what you want>'");
  });
  it("names the journey when one is open", () => {
    const j = { slug: "pay-a-bill", name: "Pay a bill" };
    expect(commandFor("journey", "add a warning screen", j)).toBe(`claude '/finx-journey Change the "Pay a bill" journey (pay-a-bill): add a warning screen'`);
    expect(commandFor("review", " the failure screens ", j)).toBe("claude '/finx-review pay-a-bill the failure screens'");
    expect(commandFor("review", "", j)).toBe("claude '/finx-review pay-a-bill'");
  });
  it("does not name a journey for code changes", () => {
    expect(commandFor("code", "fix the login", { slug: "x", name: "X" })).toBe("claude '/finx-code fix the login'");
  });
  it("names the project for a new journey, so the draft lands in that bank app", () => {
    const p = { id: "test-bank", name: "test bank" };
    expect(commandFor("journey", "a sign-in journey", undefined, p)).toBe("claude '/finx-journey For test bank (test-bank): a sign-in journey'");
    expect(commandFor("journey", "", undefined, p)).toBe("claude '/finx-journey For test bank (test-bank): <describe what you want>'");
    // a journey in view already says where it is; reviews and code changes are not about a project
    expect(commandFor("journey", "add a warning", { slug: "pay-a-bill", name: "Pay a bill" }, p)).toBe(`claude '/finx-journey Change the "Pay a bill" journey (pay-a-bill): add a warning'`);
    expect(commandFor("review", "pay-a-bill", undefined, p)).toBe("claude '/finx-review pay-a-bill'");
    expect(commandFor("code", "fix the login", undefined, p)).toBe("claude '/finx-code fix the login'");
    expect(commandFor("journey", "x", undefined, { id: "cab", name: "Cairo Amman Bank (JOD) 'web'" })).toBe(`claude '/finx-journey For Cairo Amman Bank (JOD) '\\''web'\\'' (cab): x'`);
  });
  it("keeps quotes in the request from breaking the command", () => {
    expect(commandFor("journey", "it's a \"test\"")).toBe(`claude '/finx-journey it'\\''s a "test"'`);
  });
});
