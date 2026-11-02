import { defineConfig } from "vitest/config";
import path from "node:path";
// Server-side code is tested in node; component tests opt in to a browser-like DOM with `// @vitest-environment happy-dom`.
export default defineConfig({ resolve: { alias: { "@": path.resolve(__dirname) } }, test: { environment: "node", include: ["**/*.test.{ts,tsx}"], exclude: ["node_modules/**", ".next/**"] } });
