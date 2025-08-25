import { PageSection } from "@/modules/home/components/page-section"

export function MobileHunting(props) {
  return (
    <PageSection
      ref={props.ref}
      {...props}>
      <h2>Mobile Hunting</h2>
    </PageSection>
  )
}
