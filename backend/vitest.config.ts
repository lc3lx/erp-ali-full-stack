import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/env-shim.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
