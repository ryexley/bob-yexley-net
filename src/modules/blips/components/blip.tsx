import type { Blip as BlipType } from "@/modules/blips/data/schema"
import { usePreloadRoute } from "@solidjs/router"
import { createSignal, onMount, splitProps, Show } from "solid-js"
// import { Icon } from "@/components/icon"
import { MarkdownRenderer as Markdown } from "@/components/markdown/renderer"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
// import { Hashtag } from "@/components/icons"
import { Stack } from "@/components/stack"
import { BlipActions } from "@/modules/blips/components/blip-actions"
import { formatBlipTimestamp } from "@/modules/blips/util"
import { pages } from "@/urls"
import { clsx as cx } from "@/util"
import "./blip.css"

export function Blip(props: {
  blip: BlipType
  onEdit?: (blipId: string) => void
  onView?: (blipId: string) => void
}) {
  const [local] = splitProps(props, ["blip", "onEdit", "onView"])
  const preloadRoute = usePreloadRoute()
  let contentRef: HTMLDivElement | undefined
  const [isClipped, setIsClipped] = createSignal(false)
  const [showReadMore, setShowReadMore] = createSignal(false)
  const canOpenDetails = () => isClipped() || typeof local.onView === "function"

  const preloadDetails = () => {
    if (typeof local.onView !== "function") {
      return
    }

    preloadRoute(pages.blip(local.blip.id), { preloadData: true })
  }

  const openDetails = () => {
    if (typeof local.onView === "function") {
      local.onView(local.blip.id)
      return
    }

    setShowReadMore(true)
  }

  const openDetailsIfNeeded = () => {
    if (!canOpenDetails()) {
      return
    }
    openDetails()
  }

  const onMainKeyDown = (event: KeyboardEvent) => {
    if (!canOpenDetails()) {
      return
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }
    event.preventDefault()
    openDetails()
  }

  onMount(() => {
    if (contentRef) {
      setIsClipped(contentRef.scrollHeight > contentRef.clientHeight)
    }
  })

  return (
    <li>
      <Stack>
        <div class="blip">
          <div
            class={cx("blip-main", { interactive: canOpenDetails() })}
            onPointerEnter={preloadDetails}
            onFocus={preloadDetails}
            onTouchStart={preloadDetails}
            onClick={openDetailsIfNeeded}
            onKeyDown={onMainKeyDown}
            role={canOpenDetails() ? "button" : undefined}
            tabIndex={canOpenDetails() ? 0 : undefined}>
            <header>
              <span class="timestamp">
                {/* TODO: wrap this in a tooltip that shows the full timestamp */}
                {formatBlipTimestamp(local.blip.created_at)}
              </span>
            </header>
            <div
              ref={contentRef}
              class={cx("blip-content", { preview: isClipped() })}>
              <Markdown content={local.blip.content} />
              <Show when={canOpenDetails()}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={event => {
                    event.stopPropagation()
                    openDetails()
                  }}
                  class="read-more"
                  label="Read more"
                  iconRight="arrow_forward"
                />
              </Show>
            </div>
          </div>
          {/*
          <footer>
            <div class="tags">
              <Hashtag size="0.85rem" />
              <ul class="tag-list">
                <li class="tag">
                  <a href="#">faith</a>
                </li>
                <li class="tag">
                  <a href="#">life</a>
                </li>
                <li class="tag">
                  <a href="#">football</a>
                </li>
                <li class="tag">
                  <a href="#">javascript</a>
                </li>
              </ul>
            </div>
            <div class="comments">
              <Icon name="forum" />
            </div>
          </footer>
          */}
        </div>
        <BlipActions
          blip={local.blip}
          onEdit={local.onEdit}
        />
        <Dialog
          open={showReadMore()}
          class="blip-readmore-dialog"
          overlayClass="blip-readmore-overlay"
          onOpenChange={setShowReadMore}>
          <DialogHeader class="blip-readmore-header">
            <DialogTitle class="blip-readmore-title">
              {formatBlipTimestamp(local.blip.created_at)}
            </DialogTitle>
            <DialogCloseButton
              class="blip-readmore-close"
              aria-label="Close dialog"
            />
          </DialogHeader>
          <DialogBody class="blip-readmore-content">
            <DialogDescription>
              <Markdown content={local.blip.content} />
            </DialogDescription>
          </DialogBody>
        </Dialog>
      </Stack>
    </li>
  )
}
