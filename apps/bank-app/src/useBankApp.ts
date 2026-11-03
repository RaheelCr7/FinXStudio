import { useSyncExternalStore } from "react";
import type { BankApp } from "@finx/bank-client";

/** Redraws the component whenever the app store changes, and gives it the current state. */
export const useBankApp = (app: BankApp) => useSyncExternalStore(app.subscribe, app.getState, app.getState);
