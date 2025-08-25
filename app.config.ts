import { defineConfig } from "@solidjs/start/config"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "~": "/src",
        "@": "/src",
      },
    },
    plugins: [tailwindcss()],
  },
})
