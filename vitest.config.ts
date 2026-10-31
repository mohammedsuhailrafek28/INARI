import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // Cold transform caches make the HTTP e2e setup (dynamic imports) slow; the default 10s hook timeout skipped that whole file.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
