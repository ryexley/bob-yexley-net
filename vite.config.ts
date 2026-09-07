import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

const src = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  plugins: [solidStart(), nitro(), tailwindcss()],
  resolve: {
    alias: {
      "~": src,
      "@": src,
    },
  },
  nitro: {
    vercel: {
      functions: {
        maxDuration: 60,
      },
    },
  },
  optimizeDeps: {
    // Start 2 + Vite 8 rediscovers client deps after the first transform,
    // then 504s the in-flight `?v=` hashes. Prebundle the ones the home
    // shell and first navigations actually import.
    holdUntilCrawlEnd: true,
    entries: [
      "src/entry-client.tsx",
      "src/app.tsx",
      "src/**/*.{ts,tsx}",
      "!src/**/*.spec.{ts,tsx}",
    ],
    include: [
      "@formatjs/intl",
      "@kobalte/core",
      "@kobalte/core/**",
      "@corvu/drawer",
      "@milkdown/core",
      "@milkdown/plugin-emoji",
      "@milkdown/plugin-listener",
      "@milkdown/plugin-slash",
      "@milkdown/preset-commonmark",
      "@milkdown/prose",
      "@milkdown/prose/**",
      "@milkdown/utils",
      "@solidjs/start/fns/client",
      "@supabase/ssr",
      "@supabase/supabase-js",
      "@uppy/aws-s3",
      "@uppy/core",
      "class-variance-authority",
      "clsx",
      "date-fns",
      "date-fns/**",
      "exifr",
      "fontfaceobserver",
      "micromark-extension-mark/index.js",
      "solid-transition-group",
      "tailwind-merge",
      "zod",
    ],
  },
  server: {
    port: 7808,
    host: true,
    allowedHosts: ["bobs-monarx-macbook-pro.local"],
  },
})
