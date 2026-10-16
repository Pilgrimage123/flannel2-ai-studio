import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: /^@\/(.*)/, replacement: path.resolve(import.meta.dirname, "./src/$1") },
        { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
