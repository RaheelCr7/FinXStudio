import type { Journey } from "../schema";
export const freezeCardAcceptance: NonNullable<Journey["acceptance"]> = [{ id: "AC-1", text: "stub" }];
export const freezeCardScenarios: NonNullable<Journey["scenarios"]> = [{ id: "T-1", name: "stub", covers: ["AC-1"], persona: "alex", steps: [{ expectScreen: "start" }] }];
