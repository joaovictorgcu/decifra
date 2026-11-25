import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3333", changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: "http://127.0.0.1:3333", changeOrigin: false } },
  },
  build: { sourcemap: true, target: "es2022" },
});
