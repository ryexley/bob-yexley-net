const ESV_BASE_URL = "https://api.esv.org/v3/passage/text/"

type EsvPassageResponse = {
  passages?: string[]
}

export async function fetchEsvPassageText(
  reference: string,
  apiKey: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    q: reference,
    "include-passage-references": "false",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "true",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
  })

  const response = await fetch(`${ESV_BASE_URL}?${params}`, {
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as EsvPassageResponse
  const passage = data.passages?.[0]

  if (!passage) {
    return null
  }

  return passage
}
