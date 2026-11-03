"use client";
import type { CSSProperties } from "react";
import { ensureContrast, resolveBrand, type BrandDef } from "@finx/ui-kit";
import { AppBar, Button, ListRow, TextField, brandVars, componentsCss } from "@finx/components";

export type PreviewMode = "light" | "dark" | "contrast";

const WORDS = {
  ltr: { title: "Sign in", user: "Username", pass: "Password", row: "Enroll your account", help: "Create your digital banking profile", go: "Sign in", other: "Can't sign in?" },
  rtl: { title: "تسجيل الدخول", user: "اسم المستخدم", pass: "كلمة المرور", row: "سجّل حسابك", help: "أنشئ ملفك المصرفي الرقمي", go: "تسجيل الدخول", other: "لا يمكنني الدخول؟" },
};

/** A sign-in screen drawn by the shared components in a bank's look, as the wizard and the Design area show it. */
export function LookPreview({ def, mode = "light", rtl }: { def: BrandDef; mode?: PreviewMode; rtl?: boolean }) {
  const brand = resolveBrand("draft", def);
  const vars: Record<string, string> = brandVars(brand, mode === "dark" ? "dark" : "light");
  if (mode === "contrast") {
    Object.assign(vars, { "--c-bg": "#FFFFFF", "--c-surface": "#FFFFFF", "--c-text": "#000000", "--c-text-muted": "#1A1A1A", "--c-border": "#000000", "--c-border-strong": "#000000", "--c-accent": ensureContrast(brand.light.colors.accent!, "#FFFFFF", 7) });
  }
  const w = WORDS[rtl ? "rtl" : "ltr"];
  const bar = def.look?.chrome === "bar";
  const look = def.look?.fields === "outlined" ? "outlined" : "standard";
  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ ...(vars as CSSProperties), background: "var(--c-bg)", color: "var(--c-text)", fontFamily: "system-ui, sans-serif", colorScheme: mode === "dark" ? "dark" : "light", borderRadius: 22, overflow: "hidden", border: "1px solid var(--border)" }}>
      <style>{componentsCss}</style>
      <AppBar title={w.title} tone={bar ? "bar" : "plain"} onBack={() => {}} onClose={() => {}} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, background: def.look?.pageBg && mode === "light" ? def.look.pageBg : undefined }}>
        <TextField label={w.user} value="" look={look} />
        <TextField label={w.pass} value="password1" secure look={look} />
        <ListRow label={w.row} icon="user" text={w.help} />
        <Button label={w.go} />
        <Button label={w.other} variant="secondary" />
      </div>
    </div>
  );
}
