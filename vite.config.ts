import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

const src = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: "jridgewell-resolve-uri-esm",
      enforce: "pre",
      async resolveId(id, importer, options) {
        if (id !== "@jridgewell/resolve-uri") {
          return
        }

        const resolved = await this.resolve(id, importer, {
          ...options,
          skipSelf: true,
        })
        if (!resolved) {
          return
        }

        return {
          ...resolved,
          id: resolved.id.replace(
            /resolve-uri\.umd\.js(?:\?.*)?$/,
            "resolve-uri.mjs",
          ),
        }
      },
    },
    solidStart(),
    nitro(),
    tailwindcss(),
  ],
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
  ssr: {
    // Keep Node-only packages out of the server bundle. Vite 8 + Nitro 3
    // otherwise can resolve the AWS SDK browser build (or fail to load
    // sharp's native binary), which 500s every /api/media/* route.
    target: "node",
    resolve: {
      conditions: ["node", "import", "module", "default"],
      externalConditions: ["node", "import", "module", "default"],
    },
    external: [
      "@aws-sdk/client-s3",
      "@aws-sdk/core",
      "@aws-sdk/s3-request-presigner",
      "heic-convert",
      "sharp",
    ],
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
      "@jridgewell/resolve-uri",
      "@jridgewell/trace-mapping",
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
    needsInterop: ["@jridgewell/resolve-uri"],
  },
  server: {
    port: 7808,
    host: true,
    allowedHosts: ["bobs-monarx-macbook-pro.local"],
  },
})
