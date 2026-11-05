import type { Journey } from "../schema";
export const activateCardAcceptance: NonNullable<Journey["acceptance"]> = [{ id: "AC-1", text: "stub" }];
export const activateCardScenarios: NonNullable<Journey["scenarios"]> = [{ id: "T-1", name: "stub", covers: ["AC-1"], persona: "alex", steps: [{ expectScreen: "start" }] }];
