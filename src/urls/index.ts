export const pages = {
  home: "/",
  signals: "/signals",
  blips: "/blips",
  blip: (id: string) => `/blips/${id}`,
  blipsTag: (tag: string) => `/blips/tag/${tag}`,
  resume: "/resume/",
  login: "/a/li",
  logout: "/a/lo",
}

export const external = {
  duckDuckGoMapUrl: address =>
    `https://duckduckgo.com/?q=${address.line1.replace(/ /g, "+")}+${address.city}+${address.state}+${address.postalCode}&ia=web&iaxm=maps`,
  mapUrl: address =>
    `//maps.apple.com/?q=${address.line1.replace(/ /g, "+")}+${address.city}+${address.state}+${address.postalCode}&ia=web&iaxm=maps`,
}
