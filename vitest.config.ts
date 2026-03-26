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
  },
})
