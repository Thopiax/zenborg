import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "packages/core/**/*.test.ts",
      "mcp-server/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/core/domain/**/*.ts"],
      exclude: [
        "node_modules/",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@zenborg/core": path.resolve(__dirname, "./packages/core"),
    },
  },
});
