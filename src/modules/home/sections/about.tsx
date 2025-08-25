import { UnsplashImage } from "@/components/image"
import { PageSection } from "@/modules/home/components/page-section"

export function About(props) {
  return (
    <PageSection
      ref={props.ref}
      {...props}>
      <h2>About Harvest Archery</h2>
      <UnsplashImage
        imageId="maple-trees-WdE8-Uqgbcs"
        width={800}
      />
    </PageSection>
  )
}
