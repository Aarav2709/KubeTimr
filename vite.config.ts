import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    // keep vite's import helper out of the entry so cubing workers never load the app
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper")) return "preload-helper";
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
