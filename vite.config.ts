import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Keep the browser's Host header so the API's same-origin check passes.
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: false } },
  },
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
  },
});
