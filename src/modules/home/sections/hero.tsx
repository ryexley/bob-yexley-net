import { onMount } from "solid-js"
import { UnsplashImage, CloudinaryImage } from "@/components/image"
import { PageSection } from "@/modules/home/components/page-section"
// import { Stack } from "@/components/stack"
import { preloadUnsplashImages } from "@/lib/vendor/unsplash"
import { randomIndex } from "@/util/random"
import { tr } from "@/i18n"

const heroImageIds = [
  "green-trees-with-mountain-on-the-horizon-high-angle-photography-dtxihV-sX8k",
  "green-forest-near-mountain-2z2CGEB7FIk",
  "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ",
]

export function Hero(props) {
  const imageId = heroImageIds[randomIndex(heroImageIds)]

  // Start background pre-loading of all hero images (non-blocking)
  onMount(() => {
    // Use setTimeout to make it truly non-blocking
    setTimeout(() => {
      preloadUnsplashImages(heroImageIds).catch(() => {
        // Silently fail - pre-loading is not critical
      })
    }, 100)
  })

  return (
    <PageSection
      ref={props.ref}
      {...props}>
      <UnsplashImage
        imageId={imageId}
        height="100vh"
        width="100%"
        alt="East Tennessee moutains/woods"
        eager={true}
        class="absolute top-0 left-0 z-[-1] pb-0"
        brightness={0.5}
        blur={0}
      />
      <div class="min-h-[calc(100vh-var(--main-header-height))] w-full flex gap-8 flex-col items-center justify-center">
        <div class="flex items-center justify-center">
          <CloudinaryImage
            imageId="crys-and-i_i0aulu"
            class="h-[20rem]! w-[20rem]! rounded-full mt-[-10rem] drop-shadow-[0_1rem_2rem_rgba(0,0,0,1)]"
          />
        </div>
        <div class="/*flex-1*/ flex flex-col items-center justify-start gap-8 opacity-0 animate-[fade-in_1.5s_ease_1s_forwards]">
          <h2 class="text-4xl text-center uppercase font-bold text-[var(--colors-mono-11)]/80">
            {tr("site.title")}
          </h2>
          {/*
          <h3 class="text-2xl text-center uppercase font-bold text-[var(--colors-mono-11)]/70 text-balance">
            {tr("site.description")}
          </h3>
          */}
        </div>
      </div>
    </PageSection>
  )
}
