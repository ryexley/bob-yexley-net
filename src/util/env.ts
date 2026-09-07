const nodeEnv = (key: string): string | undefined => {
  if (typeof process === "undefined") {
    return undefined
  }

  return process.env?.[key]
}

export function getEnv() {
  return {
    SUPABASE_URL:
      nodeEnv("SUPABASE_URL") ||
      nodeEnv("VITE_SUPABASE_URL") ||
      import.meta.env.VITE_SUPABASE_URL ||
      "",
    SUPABASE_ANON_KEY:
      nodeEnv("SUPABASE_ANON_KEY") ||
      nodeEnv("VITE_SUPABASE_ANON_KEY") ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      "",
    SUPABASE_SERVICE_ROLE_KEY: nodeEnv("SUPABASE_SERVICE_ROLE_KEY") || "",
    WAIVER_ELECTRONIC_CLIENT_ID: nodeEnv("WAIVER_ELECTRONIC_CLIENT_ID") || "",
    WAIVER_ELECTRONIC_ACCESS_TOKEN:
      nodeEnv("WAIVER_ELECTRONIC_ACCESS_TOKEN") || "",
    WAIVER_SERVICE_WEBHOOK_ENABLED: nodeEnv("WAIVER_SERVICE_WEBHOOK_ENABLED") || false,
    SENTRY_DSN: nodeEnv("SENTRY_DSN") || "",
    CLOUDINARY_CLOUD_NAME:
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
      nodeEnv("CLOUDINARY_CLOUD_NAME") ||
      "",
    UNSPLASH_ACCESS_KEY:
      import.meta.env.VITE_UNSPLASH_ACCESS_KEY ||
      nodeEnv("UNSPLASH_ACCESS_KEY") ||
      "",
    ESV_API_KEY: nodeEnv("ESV_API_KEY") || "",
    ANALYTICS_HASH_SALT: nodeEnv("ANALYTICS_HASH_SALT") || "",
    ANALYTICS_ALLOWED_ORIGINS: nodeEnv("ANALYTICS_ALLOWED_ORIGINS") || "",
    MEDIA_STORAGE_URL:
      nodeEnv("MEDIA_STORAGE_URL") ||
      import.meta.env.VITE_MEDIA_STORAGE_URL ||
      nodeEnv("VITE_MEDIA_STORAGE_URL") ||
      "",
    R2_ENDPOINT: nodeEnv("R2_ENDPOINT") || "",
    R2_BUCKET: nodeEnv("R2_BUCKET") || "",
    R2_ACCESS_KEY_ID: nodeEnv("R2_ACCESS_KEY_ID") || "",
    R2_SECRET_ACCESS_KEY: nodeEnv("R2_SECRET_ACCESS_KEY") || "",
  }
}
