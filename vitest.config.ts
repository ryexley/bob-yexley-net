import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      "~": "/src",
      "@": "/src",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      // Report on the media upload feature and the editor plumbing it rides on.
      // Widen deliberately; a repo-wide default would bury the signal.
      include: [
        "src/modules/media/**/*.{ts,tsx}",
        "src/components/markdown/editor/**/*.{ts,tsx}",
        // Inline-embed markdown round-trip: the syntax layer the paste path
        // serializes through.
        "src/components/markdown/media/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.spec.{ts,tsx}",
        // Type-only and re-export surfaces have no executable lines.
        "src/modules/media/types.ts",
        "src/modules/media/index.ts",
        // Binary fixtures live under the media module; the coverage remapper
        // tries to parse anything matched by `include` as source.
        "**/__fixtures__/**",
        "**/fixtures/**",
      ],
    },
  },
})
