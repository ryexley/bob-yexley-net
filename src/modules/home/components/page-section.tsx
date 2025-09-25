import { splitProps } from "solid-js"
import { cx, merge } from "@/util"
import "./page-section.css"

export function PageSection(props) {
  const [local, rest] = splitProps(props, ["class", "children", "ref"])

  return (
    <section
      class={merge(cx("page-section", local.class))}
      ref={local.ref}
      {...rest}>
      {local.children}
    </section>
  )
}
