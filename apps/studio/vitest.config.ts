import { defineConfig } from "vitest/config";
import path from "node:path";

// lets tests import API route handlers, which use the "@/" alias like the rest of the app
export default defineConfig({ resolve: { alias: { "@": path.resolve(__dirname) } } });
