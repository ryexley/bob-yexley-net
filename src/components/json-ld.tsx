import { JSX } from "solid-js"

export type JsonLdProps = {
  data: object
}

export function JsonLd(props: JsonLdProps): JSX.Element {
  const jsonString = () => {
    const json = JSON.stringify(props.data, null, 0)
    return json.replace(/</g, "\\u003c")
  }

  return (
    <script 
      type="application/ld+json"
      // @ts-expect-error - innerHTML works in SolidJS
      innerHTML={jsonString()}
    />
  )
}

const SITE_URL = "https://bob.yexley.net"
const PERSON_ID = `${SITE_URL}/#person`

export const PERSON_SCHEMA = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Bob Yexley",
  url: SITE_URL,
  image: `${SITE_URL}/og-image.jpg`,
  sameAs: ["https://github.com/ryexley"],
}

export function createWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "bob.yexley.net",
      },
      PERSON_SCHEMA,
    ],
  }
}

export function createBlogPostingSchema(props: {
  headline: string
  datePublished: string
  dateModified?: string
  canonicalUrl: string
  image?: string
  keywords?: string[]
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: props.headline,
    datePublished: props.datePublished,
    dateModified: props.dateModified || props.datePublished,
    author: {
      "@id": PERSON_ID,
    },
    mainEntityOfPage: props.canonicalUrl,
    ...(props.image && { image: props.image }),
    ...(props.keywords && props.keywords.length > 0 && { keywords: props.keywords.join(", ") }),
  }
}
