import { tr } from "@/i18n"
import { splitProps } from "solid-js"

export function CallUsLink(props) {
  const [local, others] = splitProps(props, ["children"])
  const phoneNumber = tr("org.phoneNumber")

  return (
    <a
      href={`tel:${phoneNumber}`}
      {...others}>
      {local.children}
    </a>
  )
}
