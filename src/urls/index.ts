export const pages = {
  home: "/",
  signals: "/signals",
  blips: "/blips",
  blip: (id: string) => `/blips/${id}`,
  blipsTag: (tag: string) => `/blips/tag/${tag}`,
  resume: "/resume/",
  admin: "/a",
  login: "/a/li",
  users: "/a/users",
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
