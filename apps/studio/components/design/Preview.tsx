"use client";
import type { CSSProperties, ReactNode } from "react";
import { componentCssVars, resolveComponentTokens, type ComponentTokenOverrides, type ComponentTokens } from "@finx/ui-kit";
import { brandVars, componentsCss } from "@finx/components";
import { KitProvider, kitFor } from "@finx/components/native";
import { View } from "react-native";
import type { ProjectInfo } from "../Projects";

/** The native components, drawn by react-native-web, in one bank's look. */
export function NativeThemed({ project, mode, rtl, children }: { project: ProjectInfo; mode: "light" | "dark"; rtl?: boolean; children: ReactNode }) {
  const kit = kitFor(project.brand, mode, !!rtl);
  return (
    <KitProvider kit={kit}>
      <View style={{ backgroundColor: kit.c.bg, direction: rtl ? "rtl" : "ltr" } as never}>{children}</View>
    </KitProvider>
  );
}

/** Gives the shared components one bank's colours, radii and sizes. Sizes may be a draft that is not saved yet. */
export function Themed({ project, mode, rtl, tokens, children, style }: { project: ProjectInfo; mode: "light" | "dark"; rtl?: boolean; tokens?: ComponentTokens | ComponentTokenOverrides; children: ReactNode; style?: CSSProperties }) {
  const vars = { ...brandVars(project.brand, mode), ...(tokens ? componentCssVars(resolveComponentTokens(tokens, project.brand.radius)) : {}) };
  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ ...(vars as CSSProperties), background: "var(--c-bg)", color: "var(--c-text)", fontFamily: "system-ui, sans-serif", colorScheme: mode, ...style }}>
      <style>{componentsCss}</style>
      {children}
    </div>
  );
}
