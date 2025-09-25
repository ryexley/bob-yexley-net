import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js"
import { Meta, Title } from "@solidjs/meta"
import { useLocation } from "@solidjs/router"
import { Hero } from "@/modules/home/sections/hero"
import { Signals } from "~/modules/home/sections/signals"
// import { Footer } from "@/modules/home/sections/footer"
import { tr } from "@/i18n"
import { pages } from "@/urls"
import { cx } from "@/util"
import { windowTitle, withWindow } from "@/util/browser"

const homeStyles = cx()

function replacePath(path: string) {
  withWindow((window: Window) => {
    window.history.replaceState(null, "", path)
    window.dispatchEvent(
      new CustomEvent("main-nav-path-changed", {
        detail: { path },
      }),
    )
  })
}

export function Home() {
  const location = useLocation()

  // Initialize with the current path - don't default to home
  const [activeSectionPath, setActiveSectionPath] = createSignal(
    location.pathname,
  )

  let homeRef: HTMLElement | undefined
  let signalsRef: HTMLElement | undefined

  const pageSections = createMemo(() => [
    {
      id: "home",
      path: pages.home,
      label: "Home",
      setRef: (el: HTMLElement) => (homeRef = el),
      getRef: () => homeRef,
      component: Hero,
      pageTitle: tr("home.pageSections.hero.pageTitle"),
      metaDescription: tr("home.pageSections.hero.metaDescription"),
    },
    {
      id: "signals",
      path: pages.signals,
      label: "Signals",
      setRef: (el: HTMLElement) => (signalsRef = el),
      getRef: () => signalsRef,
      component: Signals,
      pageTitle: tr("home.pageSections.signals.pageTitle"),
      metaDescription: tr("home.pageSections.signals.metaDescription"),
    },
  ])

  const currentSection = createMemo(() => {
    const path = activeSectionPath()
    return pageSections().find(sec => sec.path === path) || pageSections()[0]
  })

  onMount(() => {
    // const blipsRealtimeSubscription = initBlipsRealtime()

    let lastPath = location.pathname

    if (lastPath !== pages.home) {
      const initialTarget = pageSections().find(
        section => section.path === lastPath,
      )
      const initialElement = initialTarget?.getRef()
      if (initialElement) {
        initialElement.scrollIntoView({
          behavior: "auto",
          block: "start",
        })
      }
    }

    const headerHeight =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--main-header-height",
        ),
      ) || 0

    const sectionObservers = pageSections()
      .filter(section => section?.path !== pages.home)
      .map(section => {
        const element = section.getRef()
        if (!element) {
          return null
        }

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && section.path !== lastPath) {
              setActiveSectionPath(section.path)
              replacePath(section.path)
              lastPath = section.path
            }
          },
          {
            root: null,
            threshold: 0,
            rootMargin: `-${headerHeight}px 0px -100% 0px`,
          },
        )

        observer.observe(element)

        return observer
      })

    const homeSection = pageSections()[0].getRef()
    const homeSectionScroll = () => {
      const secondSectionTop =
        pageSections()[1]?.getRef()?.offsetTop ?? Infinity

      if (
        homeSection &&
        window.scrollY < secondSectionTop - headerHeight &&
        lastPath !== pages.home
      ) {
        setActiveSectionPath(pages.home)
        replacePath(pages.home)
        lastPath = pages.home
      }
    }

    window.addEventListener("scroll", homeSectionScroll)

    onCleanup(() => {
      sectionObservers?.forEach(observer => {
        if (observer) {
          observer.disconnect()
        }
      })

      window.removeEventListener("scroll", homeSectionScroll)

      // blipsRealtimeSubscription.unsubscribe()
    })
  })

  return (
    <>
      <Title>{windowTitle(currentSection().pageTitle as string)}</Title>
      <Meta
        name="description"
        content={currentSection().metaDescription as string}
      />
      <main class={homeStyles}>
        <For each={pageSections()}>
          {section => {
            const Component = section.component

            return (
              <Component
                ref={section.setRef}
                data-home-section-id={section.id}
              />
            )
          }}
        </For>
      </main>
      {/* <Footer /> */}
    </>
  )
}
