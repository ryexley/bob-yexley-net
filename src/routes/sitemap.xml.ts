import type { APIEvent } from "@solidjs/start/server"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectWithSlugFallback } from "@/modules/blips/data/queries"
import { blipUrl } from "@/urls"

const SITE_URL = "https://bob.yexley.net"

export async function GET({ request }: APIEvent) {
  try {
    const supabase = await getServerClient()
    
    // Fetch all blips (view_blips already filters for roots, RLS handles visibility)
    const { data, error } = await selectWithSlugFallback(
      "id, slug, updated_at, publish_at",
      select =>
        supabase
          .from("view_blips")
          .select(select)
          .order("sort_at", { ascending: false })
          .order("created_at", { ascending: false }),
    )
    const blips = (data ?? null) as unknown as Array<{
      id: string
      slug?: string | null
      updated_at: string | null
      publish_at: string | null
    }> | null

    if (error) {
      console.error("[sitemap] Error fetching blips:", error)
    }

    const urls = [
      { loc: `${SITE_URL}/`, lastmod: null, priority: "1.0" },
      { loc: `${SITE_URL}/blips`, lastmod: null, priority: "0.9" },
      { loc: `${SITE_URL}/blips/tags`, lastmod: null, priority: "0.8" },
      { loc: `${SITE_URL}/resume/`, lastmod: null, priority: "0.8" },
    ]

    // Add all blip permalinks
    if (blips && blips.length > 0) {
      for (const blip of blips) {
        urls.push({
          loc: blipUrl(SITE_URL, blip),
          lastmod: blip.updated_at || blip.publish_at,
          priority: "0.7",
        })
      }
    }

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    url => `  <url>
    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${new Date(url.lastmod).toISOString()}</lastmod>` : ""}
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("[sitemap] Unexpected error:", error)
    return new Response("Error generating sitemap", { status: 500 })
  }
}
