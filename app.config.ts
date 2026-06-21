import { defineConfig } from "@solidjs/start/config"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  server: {
    vercel: {
      // Global ceiling for all Vercel functions. The media image-processing route
      // (sharp WebP variant generation, incl. large HEIC decodes) can exceed the
      // default timeout; 60s is the Hobby-plan maximum. A ceiling only — it does
      // not increase cost for fast requests. Set globally rather than via
      // `functionRules` to avoid Nitro duplicating the server bundle per route.
      functions: {
        maxDuration: 60,
      },
    },
  },
  vite: {
    resolve: {
      alias: {
        "~": "/src",
        "@": "/src",
      },
    },
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ["bobs-monarx-macbook-pro.local"],
    },
  },
})
