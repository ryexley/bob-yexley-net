import { For } from "solid-js"
import { Link } from "@solidjs/meta"

export const links = [
  {
    rel: "dns-prefetch",
    href: "https://fonts.googleapis.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,300..800;1,300..700&display=swap",
  },
  {
    rel: "icon",
    href: "/favicon.ico",
    type: "image/x-icon",
  },
  {
    rel: "icon",
    href: "/favicon-emoji.png",
    type: "image/png",
  },
  {
    rel: "apple-touch-icon",
    href: "/favicon-emoji.png",
  },
  {
    rel: "alternate",
    type: "application/rss+xml",
    title: "bob.yexley.net — Blips",
    href: "/rss.xml",
  },
]

export function SharedHeadContent() {
  return (
    <>
      <For each={links}>{link => <Link {...(link as any)} />}</For>
    </>
  )
}
