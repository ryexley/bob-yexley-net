import { createMemo, onMount } from "solid-js"
import { createAsync } from "@solidjs/router"
import { UnsplashImage, CloudinaryImage } from "@/components/image"
import { PageSection } from "@/modules/home/components/page-section"
// import { Stack } from "@/components/stack"
import { preloadUnsplashImages } from "@/lib/vendor/unsplash"
import { getHomeHeroImageIds } from "@/modules/site-settings/data/queries"
import { DEFAULT_HOME_HERO_IMAGE_IDS } from "@/modules/site-settings/home-hero-images"
import { randomIndex } from "@/util/random"
import { tr } from "@/i18n"
import "./hero.css"

export function Hero(props) {
  const heroImagesQuery = createAsync(() => getHomeHeroImageIds())
  const heroImageIds = createMemo(() => {
    const loaded = heroImagesQuery()
    return loaded && loaded.length > 0
      ? loaded
      : [...DEFAULT_HOME_HERO_IMAGE_IDS]
  })

  // Reading the query in this memo suspends until site settings resolve, so
  // the first pick is from the saved list. Seeding from
  // DEFAULT_HOME_HERO_IMAGE_IDS and only replacing when the current id was
  // missing hid every newly added image while the original defaults remained.
  let pickedImageId: string | undefined
  const imageId = createMemo(() => {
    const ids = heroImageIds()
    if (!pickedImageId || !ids.includes(pickedImageId)) {
      pickedImageId = ids[randomIndex(ids)]
    }
    return pickedImageId
  })

  // Start background pre-loading of all hero images (non-blocking)
  onMount(() => {
    // Use setTimeout to make it truly non-blocking
    setTimeout(() => {
      preloadUnsplashImages(heroImageIds()).catch(() => {
        // Silently fail - pre-loading is not critical
      })
    }, 100)
  })

  return (
    <PageSection
      ref={props.ref}
      {...props}>
      <UnsplashImage
        imageId={imageId()}
        height="100svh"
        width="100%"
        alt="East Tennessee moutains/woods"
        eager={true}
        class="absolute top-0 left-0 z-[-1] pb-0"
        brightness={0.5}
        blur={0}
      />
      <div class="min-h-[calc(100svh-var(--main-header-height))] w-full flex gap-8 flex-col items-center justify-center">
        <div class="flex items-center justify-center">
          <CloudinaryImage
            imageId="crys-and-i_i0aulu"
            alt={tr("site.title") as string}
            class="hero-portrait transition-all duration-250 ease-in-out rounded-[50%] drop-shadow-[0_1rem_2rem_rgba(0,0,0,1)]"
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
