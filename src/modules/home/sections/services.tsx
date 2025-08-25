import { CloudinaryImage } from "@/components/image"
import { PageSection } from "@/modules/home/components/page-section"

export function Services(props) {
  return (
    <PageSection
      ref={props.ref}
      {...props}>
      <h2>Services We Offer</h2>
      <CloudinaryImage
        imageId="arrows-on-the-jig-wheel_fuwvvd"
        alt="arrows on the jig wheel"
        width={450}
      />
    </PageSection>
  )
}
