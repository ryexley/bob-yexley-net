import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js"
import { useLocation } from "@solidjs/router"
import { Hero } from "@/modules/home/sections/hero"
// import { About } from "@/modules/home/sections/about"
// import { Services } from "@/modules/home/sections/services"
// import { MobileHunting } from "@/modules/home/sections/mobile-hunting"
import { Footer } from "@/modules/home/sections/footer"
import { MainHeader } from "@/modules/home/components/main-header"
// import { ContactInfoPanel } from "@/modules/home/components/contact-info-panel"
import { tr } from "@/i18n"
import { pages } from "@/urls"
import { cx } from "@/util"
import { windowTitle, withWindow } from "@/util/browser"

const homeStyles = cx()

function setWindowTitle(title: string) {
  withWindow((window: Window) => {
    window.document.title = title
  })
}

function setMetaDescription(description: string) {
  withWindow((window: Window) => {
    let metaDescription = window.document.querySelector(
      // eslint-disable-next-line quotes
      'meta[name="description"]',
    )

    if (!metaDescription) {
      metaDescription = window.document.createElement("meta")
      metaDescription.setAttribute("name", "description")
      window.document.head.appendChild(metaDescription)
    }

    metaDescription.setAttribute("content", description)
  })
}

export function Home() {
  const location = useLocation()

  // Initialize with the current path - don't default to home
  const [activeSectionPath, setActiveSectionPath] = createSignal(
    location.pathname,
  )

  let homeRef: HTMLElement | undefined
  // let aboutRef: HTMLElement | undefined
  // let servicesRef: HTMLElement | undefined
  // let mobileHuntingRef: HTMLElement | undefined

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
    // {
    //   id: "about",
    //   path: pages.marketing.about,
    //   label: "About",
    //   setRef: (el: HTMLElement) => (aboutRef = el),
    //   getRef: () => aboutRef,
    //   component: About,
    //   pageTitle: tr("marketing.home.pageSections.about.pageTitle"),
    //   metaDescription: tr("marketing.home.pageSections.about.metaDescription"),
    // },
    // {
    //   id: "services",
    //   path: pages.marketing.services,
    //   label: "Services",
    //   setRef: (el: HTMLElement) => (servicesRef = el),
    //   getRef: () => servicesRef,
    //   component: Services,
    //   pageTitle: tr("marketing.home.pageSections.services.pageTitle"),
    //   metaDescription: tr(
    //     "marketing.home.pageSections.services.metaDescription",
    //   ),
    // },
    // {
    //   id: "mobile-hunting",
    //   path: pages.marketing.mobileHunting,
    //   label: "Mobile Hunting",
    //   setRef: (el: HTMLElement) => (mobileHuntingRef = el),
    //   getRef: () => mobileHuntingRef,
    //   component: MobileHunting,
    //   pageTitle: tr("marketing.home.pageSections.mobileHunting.pageTitle"),
    //   metaDescription: tr(
    //     "marketing.home.pageSections.mobileHunting.metaDescription",
    //   ),
    // },
  ])

  const navMeta = createMemo(() => {
    return pageSections().map(({ path, label }) => ({
      path,
      label,
      isActive: activeSectionPath() === path,
    }))
  })

  const currentSection = createMemo(() => {
    const path = activeSectionPath()
    return pageSections().find(sec => sec.path === path) || pageSections()[0]
  })

  const handleNavItemClick = (e, path) => {
    e.preventDefault()

    // Update our custom active section signal
    setActiveSectionPath(path)
    // Update the URL without triggering navigation
    window.history.replaceState(null, "", path)

    const sectionMeta = pageSections().find(section => section.path === path)
    const element = sectionMeta?.getRef()

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  createEffect(() => {
    const section = currentSection()
    setWindowTitle(windowTitle(section.pageTitle as string))
    setMetaDescription(section.metaDescription as string)
  })

  onMount(() => {
    let lastPath = location.pathname

    // Set initial page title and meta description
    const initialSection = currentSection()
    setWindowTitle(windowTitle(initialSection.pageTitle as string))
    setMetaDescription(initialSection.metaDescription as string)

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
        if (!element) return null

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && section.path !== lastPath) {
              setActiveSectionPath(section.path)
              window.history.replaceState(null, "", section.path)
              lastPath = section.path
              // Update title and meta description when section changes
              setWindowTitle(windowTitle(section.pageTitle as string))
              setMetaDescription(section.metaDescription as string)
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
        window.history.replaceState(null, "", pages.home)
        lastPath = pages.home
        // Update title and meta description when returning to home section
        setWindowTitle(windowTitle(pageSections()[0].pageTitle as string))
        setMetaDescription(pageSections()[0].metaDescription as string)
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
    })
  })

  return (
    <>
      <MainHeader
        meta={navMeta}
        onNavItemClick={handleNavItemClick}
      />
      <main class={homeStyles}>
        <For each={pageSections()}>
          {section => {
            const Component = section.component

            return <Component ref={section.setRef} />
          }}
        </For>
        {/* <ContactInfoPanel /> */}
      </main>
      <Footer />
    </>
  )
}
