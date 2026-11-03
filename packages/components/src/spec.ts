import type { ComponentType } from "react";

/** What a person (or the AI) needs to know to use a component, and the states the gallery and tests render. */
export type ComponentSpec<P = any> = {
  name: string;
  purpose: string;
  group: "Actions" | "Inputs" | "Navigation" | "Lists" | "Verification";
  Component: ComponentType<P>;
  props: { name: string; type: string; default?: string; description: string }[];
  /** Every state worth seeing: empty, filled, error, disabled, long text, and so on. */
  states: { name: string; props: P; /** Shown on the bank's coloured bar instead of the page. */ onBar?: boolean }[];
  a11y: string[];
  /** The tokens (brands.json "components") that change its size. */
  tokens?: string[];
};
