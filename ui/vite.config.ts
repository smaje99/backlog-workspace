import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.BACKLOG_API_PORT ?? 8794);

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src")
    }
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/app-assets": `http://localhost:${apiPort}`
    }
  }
});
