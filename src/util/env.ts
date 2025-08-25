export function getEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    WAIVER_ELECTRONIC_CLIENT_ID: process.env.WAIVER_ELECTRONIC_CLIENT_ID || "",
    WAIVER_ELECTRONIC_ACCESS_TOKEN:
      process.env.WAIVER_ELECTRONIC_ACCESS_TOKEN || "",
    WAIVER_SERVICE_WEBHOOK_ENABLED:
      process.env.WAIVER_SERVICE_WEBHOOK_ENABLED || false,
    SENTRY_DSN: process.env.SENTRY_DSN || "",
    CLOUDINARY_CLOUD_NAME:
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      "",
    UNSPLASH_ACCESS_KEY:
      import.meta.env.VITE_UNSPLASH_ACCESS_KEY ||
      process.env.UNSPLASH_ACCESS_KEY ||
      "",
  }
}
