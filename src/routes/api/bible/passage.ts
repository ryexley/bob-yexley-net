import type { APIEvent } from "@solidjs/start/server"
import {
  getBiblePassage,
  parseBiblePassageQuery,
} from "@/modules/api/bible/get-passage"

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

export async function GET({ request }: APIEvent) {
  const searchParams = new URL(request.url).searchParams
  const query = parseBiblePassageQuery(searchParams)

  if (!query) {
    return jsonResponse(
      {
        error: "Missing or invalid passage parameters",
      },
      400,
    )
  }

  const result = await getBiblePassage(query, {
    writeCache: searchParams.get("cache") !== "false",
  })

  if (result.success === false) {
    return jsonResponse(
      {
        error: result.error,
      },
      result.status,
    )
  }

  return jsonResponse(
    {
      reference: result.reference,
      passage: result.passage,
    },
    200,
  )
}
