// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server"

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
), context => {
  const pathname = new URL(context.request.url).pathname
  // Keep /blips/:id on async SSR so link unfurlers receive fully resolved
  // metadata (og:title/og:description) in the first HTML response.
  // Blip IDs are fixed to a 17-digit timestamp format.
  const isBlipDetailRoute = /^\/blips\/\d{17}\/?$/.test(pathname)

  if (isBlipDetailRoute) {
    // Link unfurlers read the first HTML response only, so block streaming here.
    return { mode: "async" }
  }

  return { mode: "stream" }
})
