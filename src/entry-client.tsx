// @refresh reload
import { mount, StartClient } from "@solidjs/start/client"

const applicationHostElement = document.getElementById("app")

if (!applicationHostElement) {
  throw new Error("Missing #app element")
}

mount(() => <StartClient />, applicationHostElement)
