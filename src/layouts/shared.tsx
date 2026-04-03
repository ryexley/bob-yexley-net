import { For } from "solid-js"
import { Link, Meta } from "@solidjs/meta"

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
    href: "https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600;1,700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/icon?family=Material+Icons&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap",
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
]

const DEFAULT_SOCIAL_IMAGE_PATH = "/og-image.jpg"

const getDefaultSocialImageUrl = () => {
  const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  if (!siteUrl) {
    return DEFAULT_SOCIAL_IMAGE_PATH
  }

  return new URL(DEFAULT_SOCIAL_IMAGE_PATH, siteUrl).toString()
}

export function SharedHeadContent() {
  const socialImageUrl = getDefaultSocialImageUrl()

  return (
    <>
      <For each={links}>{link => <Link {...(link as any)} />}</For>
      <Meta
        property="og:image"
        content={socialImageUrl}
      />
      <Meta
        property="og:image:type"
        content="image/jpeg"
      />
      <Meta
        property="og:image:width"
        content="1200"
      />
      <Meta
        property="og:image:height"
        content="630"
      />
      <Meta
        name="twitter:card"
        content="summary_large_image"
      />
      <Meta
        name="twitter:image"
        content={socialImageUrl}
      />
    </>
  )
}
