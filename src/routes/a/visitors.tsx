import { useNavigate } from "@solidjs/router"
import { onMount } from "solid-js"
import { pages } from "@/urls"

export default function VisitorsRedirectRoute() {
  const navigate = useNavigate()

  onMount(() => {
    navigate(pages.users, { replace: true })
  })

  return null
}
