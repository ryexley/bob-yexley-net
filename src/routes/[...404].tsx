import { A } from "@solidjs/router"
import { getRequestEvent } from "solid-js/web"
import { Seo } from "@/components/seo"

export default function NotFound() {
  const event = getRequestEvent()
  if (event && event.response) {
    event.response.status = 404
  }

  return (
    <>
      <Seo
        title="Page not found · Bob Yexley"
        description="The page you're looking for doesn't exist."
        path="/404"
        type="website"
        noindex={true}
      />
      <main class="text-center mx-auto text-gray-700 p-4">
        <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">
          Page Not Found
        </h1>
        <p class="mt-8">
          The page you're looking for doesn't exist.
        </p>
        <p class="my-4">
          <A
            href="/"
            class="text-sky-600 hover:underline">
            Go Home
          </A>
          {" or "}
          <A
            href="/blips"
            class="text-sky-600 hover:underline">
            View Blips
          </A>
        </p>
      </main>
    </>
  )
}
