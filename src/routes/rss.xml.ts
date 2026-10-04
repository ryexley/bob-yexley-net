import type { APIEvent } from "@solidjs/start/server"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { marked } from "marked"

const SITE_URL = "https://bob.yexley.net"
const FEED_ITEM_LIMIT = 50

// Helper to derive title from blip content
function deriveBlipTitle(content: string, maxLength = 60): string {
  // Try to extract first markdown heading
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim()
  }

  // Fall back to first sentence of plain text
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[*-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_=~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const firstSentence = plainText.split(/[.!?]/)[0]?.trim() || plainText
  if (firstSentence.length <= maxLength) {
    return firstSentence
  }

  const truncated = firstSentence.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(" ")
  return lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated
}

// Helper to derive description from blip content
function deriveBlipDescription(content: string, maxLength = 155): string {
  // Remove the first heading line
  const withoutHeading = content.replace(/^#{1,6}\s+.+$/m, "").trim()
  
  // Convert to plain text
  const plainText = withoutHeading
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[*-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_=~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  const truncated = plainText.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "..."
}

// Escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function GET({ request }: APIEvent) {
  try {
    const supabase = await getServerClient()
    
    // Fetch latest blips (view_blips already filters for roots, RLS handles visibility)
    const { data: blips, error } = await supabase
      .from("view_blips")
      .select("id, content, publish_at, updated_at")
      .order("sort_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(FEED_ITEM_LIMIT)

    if (error) {
      console.error("[rss] Error fetching blips:", error)
    }

    const items = (blips || []).map(blip => {
      const title = escapeXml(deriveBlipTitle(blip.content || ""))
      const description = escapeXml(deriveBlipDescription(blip.content || ""))
      const link = `${SITE_URL}/blips/${blip.id}`
      const pubDate = new Date(blip.publish_at || blip.updated_at).toUTCString()
      
      // Render markdown to HTML for content:encoded
      let contentHtml = ""
      try {
        contentHtml = marked.parse(blip.content || "") as string
      } catch (e) {
        contentHtml = escapeXml(blip.content || "")
      }

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
    </item>`
    })

    const lastBuildDate = blips && blips[0] 
      ? new Date(blips[0].publish_at || blips[0].updated_at).toUTCString()
      : new Date().toUTCString()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>bob.yexley.net — Blips</title>
    <link>${SITE_URL}</link>
    <description>Moments, thoughts and updates from Bob Yexley</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("[rss] Unexpected error:", error)
    return new Response("Error generating RSS feed", { status: 500 })
  }
}
