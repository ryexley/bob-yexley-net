import { SharedHeadContent } from "@/layouts/shared"

export function MainLayout(props) {
  return (
    <>
      <SharedHeadContent />
      {props.children}
    </>
  )
}
