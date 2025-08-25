import { cx } from "@/util"
import { SharedHeadContent } from "@/layouts/shared"

const adminLayoutStyles = cx()

export function AdminLayout(props) {
  return (
    <>
      <SharedHeadContent />
      <main class={adminLayoutStyles}>{props.children}</main>
    </>
  )
}
