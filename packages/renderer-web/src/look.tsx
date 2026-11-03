"use client";
import { createContext, useContext } from "react";
import type { BrandLook } from "@finx/ui-kit";

/** How the bank's screens differ from the standard look, and its name for the banner when it has no logo. Provided by the player. */
export type LookInfo = { look?: BrandLook; name?: string };
export const LookContext = createContext<LookInfo>({});
export const useLook = () => useContext(LookContext);
