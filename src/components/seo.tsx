import { Title, Meta, Link } from "@solidjs/meta"
import { Show } from "solid-js"

const SITE_URL = "https://bob.yexley.net"
const SITE_NAME = "bob.yexley.net"
const OG_LOCALE = "en_US"

export type SeoProps = {
  title: string
  description: string
  path: string
  type: "website" | "article" | "profile"
  image?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  publishedTime?: string
  modifiedTime?: string
  noindex?: boolean
}

export function Seo(props: SeoProps) {
  const canonicalUrl = () => {
    const url = new URL(props.path, SITE_URL)
    url.search = ""
    return url.toString()
  }

  const absoluteImageUrl = () => {
    if (!props.image) return undefined
    if (props.image.startsWith("http")) return props.image
    return new URL(props.image, SITE_URL).toString()
  }

  return (
    <>
      <Title>{props.title}</Title>
      <Meta name="description" content={props.description} />
      <Link rel="canonical" href={canonicalUrl()} />

      <Meta property="og:title" content={props.title} />
      <Meta property="og:description" content={props.description} />
      <Meta property="og:url" content={canonicalUrl()} />
      <Meta property="og:type" content={props.type} />
      <Meta property="og:site_name" content={SITE_NAME} />
      <Meta property="og:locale" content={OG_LOCALE} />

      <Show when={absoluteImageUrl()} fallback={<Meta property="og:image" content={`${SITE_URL}/og-image.jpg`} />}>
        <Meta property="og:image" content={absoluteImageUrl()!} />
        <Show when={props.imageWidth}>
          <Meta property="og:image:width" content={String(props.imageWidth)} />
        </Show>
        <Show when={props.imageHeight}>
          <Meta property="og:image:height" content={String(props.imageHeight)} />
        </Show>
        <Show when={props.imageAlt}>
          <Meta property="og:image:alt" content={props.imageAlt} />
        </Show>
      </Show>

      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={props.title} />
      <Meta name="twitter:description" content={props.description} />
      <Show when={absoluteImageUrl()} fallback={<Meta name="twitter:image" content={`${SITE_URL}/og-image.jpg`} />}>
        <Meta name="twitter:image" content={absoluteImageUrl()!} />
      </Show>

      <Show when={props.type === "article"}>
        <Show when={props.publishedTime}>
          <Meta property="article:published_time" content={props.publishedTime} />
        </Show>
        <Show when={props.modifiedTime}>
          <Meta property="article:modified_time" content={props.modifiedTime} />
        </Show>
      </Show>

      <Show when={props.noindex}>
        <Meta name="robots" content="noindex" />
      </Show>
    </>
  )
}
