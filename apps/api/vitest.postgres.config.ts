import { defineConfig } from "vitest/config";

/** Suíte da API contra PostgreSQL (ver scripts/testar-postgres.mjs). Sem o global-setup do SQLite. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/api.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
