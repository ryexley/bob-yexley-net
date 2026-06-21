export function getEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
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
    ESV_API_KEY: process.env.ESV_API_KEY || "",
    ANALYTICS_HASH_SALT: process.env.ANALYTICS_HASH_SALT || "",
    ANALYTICS_ALLOWED_ORIGINS: process.env.ANALYTICS_ALLOWED_ORIGINS || "",
    MEDIA_STORAGE_URL:
      process.env.MEDIA_STORAGE_URL ||
      import.meta.env.VITE_MEDIA_STORAGE_URL ||
      process.env.VITE_MEDIA_STORAGE_URL ||
      "",
    R2_ENDPOINT: process.env.R2_ENDPOINT || "",
    R2_BUCKET: process.env.R2_BUCKET || "",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  }
}
