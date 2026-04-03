import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "Gatos App",
        short_name: "Gatos",
        theme_color: "#7848A8",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/cats",
        scope: "/",
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
