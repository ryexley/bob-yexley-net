import { createSignal, onMount, type Accessor } from "solid-js"

/**
 * False on the server and through this component's hydration, true right after
 * it mounts.
 *
 * Gate client-only state (like auth, which the server never applies: the auth
 * provider sets it in an effect) behind this so a component hydrates exactly
 * what the server rendered. A component that renders extra nodes while
 * hydrating crashes production Solid (`t is not a function`) as soon as one of
 * those nodes is a Kobalte button.
 */
export function createMounted(): Accessor<boolean> {
  const [mounted, setMounted] = createSignal(false)
  onMount(() => setMounted(true))
  return mounted
}
