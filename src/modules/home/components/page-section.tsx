import { splitProps } from "solid-js"
import { cx, merge } from "@/util"

export function PageSection(props) {
  const [local, rest] = splitProps(props, ["class", "children", "ref"])

  return (
    <section
      class={merge(
        cx(
          "page-section",
          "relative min-h-screen w-full p-4 pt-[var(--main-header-height)]",
          local.class,
        ),
      )}
      ref={local.ref}
      {...rest}>
      {local.children}
    </section>
  )
}
