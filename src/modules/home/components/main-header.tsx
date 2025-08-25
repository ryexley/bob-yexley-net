import { createMemo, createSignal, For, splitProps } from "solid-js"
import { Drawer } from "@/components/drawer"
import { Stack } from "@/components/stack"
import { pages } from "@/urls"
import { tr } from "@/i18n"

export function MainHeader(props: any) {
  const [local] = splitProps(props, ["meta", "onNavItemClick"])
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false)

  const navLinks = createMemo(() => {
    const dynamicLinks = local.meta() || []
    const staticLinks = [
      {
        path: pages.resume,
        label: "Resume",
      },
    ].map(link => ({ ...link, isStatic: true }))

    return [...dynamicLinks, ...staticLinks]
  })

  const onMobileNavClick = (e, link) => {
    if (link.isStatic) {
      e.preventDefault()
      window.location.assign(link.path)
      setMobileNavOpen(false)
      return
    }

    local.onNavItemClick(e, link.path)
    setMobileNavOpen(false)
  }

  const handleNavClick = (e, link) => {
    if (link.isStatic) {
      e.preventDefault()
      window.location.assign(link.path)
      return
    }

    local.onNavItemClick(e, link.path)
  }

  return (
    <header class="fixed w-full flex items-center justify-between top-0 z-10 backdrop-blur-sm">
      {/*
      <a
        href={pages.home}
        class="flex !py-3 !px-5"
        onClick={e => local.onNavItemClick(e, pages.home)}>
        {tr("site.title")}
      </a>
      */}
      <span />
      <nav class="flex gap-3 items-center ml-2 mr-5 h-[var(--main-header-height)] max-[40rem]:hidden">
        <For each={navLinks()}>
          {link => (
            <a
              href={link.path}
              onClick={e => handleNavClick(e, link)}
              class={`flex items-center !py-2 !px-4 uppercase font-medium common-transition hover:!text-[var(--colors-resonant-blue)] dim-glassy-hover !rounded-full ${
                link.isActive
                  ? "!text-[var(--colors-resonant-blue)] !bg-[rgba(var(--colors-mono-01-rgb),0.5)]"
                  : ""
              }`}>
              {link.label}
            </a>
          )}
        </For>
      </nav>
      <Drawer
        open={mobileNavOpen()}
        onOpenChange={setMobileNavOpen}
        class="w-full min-[32rem]:w-[18.75rem]"
        headerClass="h-[var(--main-header-height)] justify-center"
        title={tr("home.components.mainHeader.mobileNav.title")}
        titleClass="text-[1.5rem] font-[600]"
        toggleClass="hidden max-[40rem]:flex items-center justify-center h-12 w-12 px-7 py-6 focus:!outline-none focus:!shadow-none active:!outline-none active:!shadow-none focus-visible:!outline-none focus-visible:!shadow-none"
        toggleIconClass="text-[var(--colors-mono-11)] text-4xl"
        closeButtonIcon="chevron_right"
        closeButtonClass="top-2 !right-0 p-6 focus:!outline-none focus:!shadow-none active:!outline-none active:!shadow-none focus-visible:!outline-none focus-visible:!shadow-none"
        closeButtonIconClass="text-[var(--colors-mono-10)] text-5xl">
        <Stack
          gap="0"
          class="py-3">
          <For each={navLinks()}>
            {link => (
              <a
                href={link.path}
                onClick={e => onMobileNavClick(e, link)}
                class={
                  link.isActive
                    ? "flex items-center !m-0 !py-2 !px-5 w-full uppercase font-medium !rounded-none common-transition !text-[var(--colors-resonant-blue)] !bg-[var(--colors-mono-02)]"
                    : "flex items-center !m-0 !py-2 !px-5 w-full uppercase font-medium !rounded-none common-transition !text-[var(--colors-links)] hover:!text-[var(--colors-resonant-blue)] hover:!bg-[var(--colors-mono-02)] focus:!outline-none focus:!shadow-none focus:!text-[var(--colors-links)] focus:!bg-transparent active:!text-[var(--colors-links)] active:!bg-transparent"
                }>
                {link.label}
              </a>
            )}
          </For>
          <hr class="!mx-4 !w-[calc(100%-2rem)]" />
        </Stack>
      </Drawer>
    </header>
  )
}
