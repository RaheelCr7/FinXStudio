import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// The native components run here on react-native-web, the same way Studio shows them; its svg is a plain-DOM stand-in.
export default defineConfig({
  resolve: { alias: { "react-native": "react-native-web", "react-native-svg": fileURLToPath(new URL("./src/test-shims/svg.tsx", import.meta.url)) } },
  test: { environment: "happy-dom", globals: false, include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./src/test-setup.ts"] },
});
