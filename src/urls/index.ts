export type BlipLinkTarget = {
  id: string
  slug?: string | null
}

/**
 * Canonical in-site path for a root blip: `/blips/{id}/{slug}`, or
 * `/blips/{id}` when the blip has no slug. Every blip link (cards, share,
 * canonical, og:url, JSON-LD, sitemap, RSS) goes through this helper.
 */
export const blipPath = (blip: BlipLinkTarget | string): string => {
  const id = typeof blip === "string" ? blip : blip.id
  const slug = typeof blip === "string" ? "" : (blip.slug ?? "").trim()
  return slug
    ? `/blips/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`
    : `/blips/${encodeURIComponent(id)}`
}

/** Absolute canonical URL for a root blip. */
export const blipUrl = (siteUrl: string, blip: BlipLinkTarget | string): string =>
  `${siteUrl.trim().replace(/\/+$/, "")}${blipPath(blip)}`

export const pages = {
  home: "/",
  signals: "/signals",
  blips: "/blips",
  blip: blipPath,
  blipsTag: (tag: string) => `/blips/tag/${tag}`,
  blipsTags: "/blips/tags",
  resume: "/resume/",
  admin: "/a",
  login: "/a/li",
  users: "/a/users",
  adminTags: "/a/tags",
  scripture: "/a/scripture",
  scriptureCollections: "/a/scripture/collections",
  scriptureCollection: (slug: string) => `/a/scripture/collections/${encodeURIComponent(slug)}`,
  scriptureCollectionById: (id: number | string) => `/a/scripture/collections/${id}`,
  scriptureReferences: "/a/scripture/references",
  analytics: "/a/analytics",
  visitors: "/a/visitors",
  logout: "/a/lo",
}

export const api = {
  media: {
    sign: "/api/media/sign",
    object: "/api/media/object",
    process: "/api/media/process",
    multipart: {
      create: "/api/media/multipart/create",
      signPart: "/api/media/multipart/sign-part",
      listParts: "/api/media/multipart/list-parts",
      complete: "/api/media/multipart/complete",
      abort: "/api/media/multipart/abort",
    },
  },
}

export const external = {
  duckDuckGoMapUrl: address =>
    `https://duckduckgo.com/?q=${address.line1.replace(/ /g, "+")}+${address.city}+${address.state}+${address.postalCode}&ia=web&iaxm=maps`,
  mapUrl: address =>
    `//maps.apple.com/?q=${address.line1.replace(/ /g, "+")}+${address.city}+${address.state}+${address.postalCode}&ia=web&iaxm=maps`,
}
