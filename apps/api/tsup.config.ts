import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/vercel.ts", "src/scripts/admin.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é TypeScript puro: entra no bundle.
  noExternal: ["@decifra/shared"],
});
